import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField, Tabs, Tab, Divider, Chip, CircularProgress, IconButton, Tooltip
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, closeAccount, hasOpenAccount, fetchOrderDetails } from '../api/tenant';
import { createMobbexCheckout, createMpPreference } from '../api/payments';
import { saveLastReceiptToStorage } from '../utils/receipt';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

// --- Helpers de estado
const getStatusLabel = (status) => {
  const map = {
    pending: 'Pendiente',
    preparing: 'En preparación',
    ready: 'Listo para servir',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    paid: 'Pagado'
  };
  return map[status] || status;
};

const getStatusColor = (status) => {
  const map = {
    pending: 'default',
    preparing: 'info',
    ready: 'success',
    delivered: 'success',
    cancelled: 'error',
    paid: 'success'
  };
  return map[status] || 'default';
};

// --- Claves de storage (para acumular totales de pedidos abiertos por mesa y restaurante)
const openOrdersKey = (slug, table) => `OPEN_ORDERS_${slug}_${table}`;

const readOpenOrders = (slug, table) => {
  try {
    const raw = localStorage.getItem(openOrdersKey(slug, table));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const writeOpenOrders = (slug, table, arr) => {
  localStorage.setItem(openOrdersKey(slug, table), JSON.stringify(arr || []));
};

const clearOpenOrders = (slug, table) => {
  localStorage.removeItem(openOrdersKey(slug, table));
};

export default function StickyFooter({ table, tableSessionId, restaurantName, sessionReady = true }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [callWaiterOpen, setCallWaiterOpen] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState(null); // 'card' | 'cash' — ningún método seleccionado por defecto
  const [payLoading, setPayLoading] = useState(false);
  const [payRequestSent, setPayRequestSent] = useState(false); // Prevenir múltiples solicitudes
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [cardType, setCardType] = useState(null); // 'credit' | 'debit'
  const [cardBrand, setCardBrand] = useState(null); // 'visa' | 'mastercard'
  const [orderDetails, setOrderDetails] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(null); // { type: 'percent' | 'fixed', value: number, code: string }
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [showMobileCoupon, setShowMobileCoupon] = useState(false);
  const [mobilePayStep, setMobilePayStep] = useState(1);

  const cardOptionsRef = useRef(null);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Estado "oficial" de si hay cuenta abierta (desde backend)
  const [backendHasAccount, setBackendHasAccount] = useState(false);

  // Registro local de pedidos abiertos y sus totales (sólo para mostrar el total en UI)
  const [openOrders, setOpenOrders] = useState([]);

  // Carga inicial de estado local y consulta al backend
  useEffect(() => {
    let cancelled = false;

    // Sincronizar openOrders con el backend para eliminar pedidos cancelados
    (async () => {
      if (!slug || !table) {
        if (!cancelled) setOpenOrders([]);
        if (!cancelled) setBackendHasAccount(false);
        return;
      }

      // Cargar lista local inicial
      const localOrders = readOpenOrders(slug, table);
      
      // Sincronizar con el backend: obtener pedidos activos reales
      try {
        const orders = await fetchOrderDetails(slug, { table, tableSessionId });
        // CRÍTICO: Filtrar pedidos cancelados
        const activeOrders = orders.filter(order => order.order_status !== 'cancelled');
        
        // Actualizar localStorage solo con pedidos activos
        const activeOrderIds = new Set(activeOrders.map(o => String(o.id)));
        const syncedOrders = localOrders.filter(lo => activeOrderIds.has(String(lo.id)));
        
        // Si hay diferencias, actualizar localStorage
        if (syncedOrders.length !== localOrders.length) {
          writeOpenOrders(slug, table, syncedOrders);
          if (!cancelled) setOpenOrders(syncedOrders);
        } else {
          if (!cancelled) setOpenOrders(localOrders);
        }
        
        // Consultar si hay cuenta abierta
        const exists = await hasOpenAccount(slug, { table, tableSessionId });
        if (!cancelled) setBackendHasAccount(Boolean(exists));
      } catch (err) {
        console.warn('Error syncing orders:', err);
        // En caso de error, usar los locales pero filtrar cancelados manualmente
        if (!cancelled) setOpenOrders(localOrders);
        if (!cancelled) setBackendHasAccount(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug, table, tableSessionId]);

  // Total mostrado en el modal de pago (suma de pedidos registrados localmente)
  // CRÍTICO: Si tenemos orderDetails (del backend), usarlos como fuente de verdad
  // Si no, usar openOrders pero solo como fallback (orderDetails ya filtra cancelados)
  const accountTotal = useMemo(() => {
    // Si tenemos orderDetails, calcular desde ahí (ya filtrados cancelados)
    if (orderDetails.length > 0) {
      return orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    }
    // Fallback: usar openOrders (que debería estar sincronizado con el backend)
    return openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  }, [openOrders, orderDetails]);

  // Calcular descuento del cupón
  const couponDiscountAmount = useMemo(() => {
    if (!couponDiscount) return 0;
    const baseTotal = orderDetails.length > 0
      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      : accountTotal;

    if (couponDiscount.type === 'percent') {
      return baseTotal * (couponDiscount.value / 100);
    } else {
      return Math.min(couponDiscount.value, baseTotal);
    }
  }, [couponDiscount, accountTotal, orderDetails]);

  // Total con propina y descuento (usar orderDetails si está disponible, sino accountTotal)
  const totalWithTip = useMemo(() => {
    const baseTotal = orderDetails.length > 0
      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      : accountTotal;
    const totalAfterDiscount = baseTotal - couponDiscountAmount;
    return Math.max(0, totalAfterDiscount + tipAmount);
  }, [accountTotal, tipAmount, orderDetails, couponDiscountAmount]);

  // Polling para sincronizar pedidos cuando hay cuenta abierta (detectar cancelaciones)
  useEffect(() => {
    if (!slug || !table || !backendHasAccount) return;

    const syncOrders = async () => {
      try {
        const orders = await fetchOrderDetails(slug, { table, tableSessionId });
        const activeOrders = orders.filter(order => order.order_status !== 'cancelled');
        
        // Sincronizar openOrders con el backend
        const activeOrderIds = new Set(activeOrders.map(o => String(o.id)));
        const currentOrders = readOpenOrders(slug, table);
        const syncedOrders = currentOrders.filter(lo => activeOrderIds.has(String(lo.id)));
        
        if (syncedOrders.length !== currentOrders.length) {
          writeOpenOrders(slug, table, syncedOrders);
          setOpenOrders(syncedOrders);
        }
        
        // Actualizar backendHasAccount
        const exists = await hasOpenAccount(slug, { table, tableSessionId });
        setBackendHasAccount(Boolean(exists));
      } catch (err) {
        console.warn('Error syncing orders in polling:', err);
      }
    };

    // Sincronizar inmediatamente
    syncOrders();
    
    // Sincronizar cada 10 segundos (evitar saturar el servidor)
    const interval = setInterval(syncOrders, 10000);
    return () => clearInterval(interval);
  }, [slug, table, tableSessionId, backendHasAccount]);

  // Cargar detalles de pedidos cuando se abre el modal de pago
  useEffect(() => {
    if (payOpen && slug && table) {
      setLoadingOrders(true);
      fetchOrderDetails(slug, { table, tableSessionId })
        .then((orders) => {
          // CRÍTICO: Filtrar pedidos cancelados - no deben aparecer en el menú del cliente
          const activeOrders = orders.filter(order => order.order_status !== 'cancelled');
          setOrderDetails(activeOrders);
          // Calcular total desde los pedidos detallados (solo activos, sin cancelados)
          const calculatedTotal = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          // Actualizar propina basada en el nuevo total
          if (tipPercentage > 0) {
            setTipAmount((calculatedTotal * tipPercentage) / 100);
          }
        })
        .catch((err) => {
          console.error('❌ Error loading order details:', err);
          setOrderDetails([]);
        })
        .finally(() => {
          setLoadingOrders(false);
        });
    } else if (!payOpen) {
      // Resetear cuando se cierra el modal
      setOrderDetails([]);
      setTipAmount(0);
      setTipPercentage(0);
      setPayMethod(null);
      setCouponCode('');
      setCouponDiscount(null);
      setPayRequestSent(false);
      setShowMobileCoupon(false);
      setMobilePayStep(1);
    }
  }, [payOpen, slug, table, tableSessionId, tipPercentage]);

  // Resetear propina cuando cambia el total (ej. al cargar orderDetails)
  useEffect(() => {
    const baseTotal = orderDetails.length > 0
      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      : accountTotal;
    const totalAfterDiscount = Math.max(0, baseTotal - couponDiscountAmount);
    if (tipPercentage > 0 && totalAfterDiscount > 0) {
      setTipAmount(Math.round((totalAfterDiscount * tipPercentage) / 100));
    }
  }, [accountTotal, tipPercentage, orderDetails, couponDiscountAmount]);

  // Guardar recibo para descarga después del pago (siempre guardar algo)
  const saveReceiptForDownload = () => {
    let items = (orderDetails || []).flatMap((o) =>
      (o.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice ?? it.unitPrice * it.quantity,
      }))
    );
    // Fallback: si no hay items, construir desde openOrders
    if (items.length === 0 && openOrders?.length > 0) {
      items = openOrders.map((o, i) => ({
        name: `Pedido #${o.id || i + 1}`,
        quantity: 1,
        unitPrice: Number(o.total) || 0,
        totalPrice: Number(o.total) || 0,
      }));
    }
    const subtotalFromItems = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
    const subtotal = subtotalFromItems > 0 ? subtotalFromItems : accountTotal;
    const discount = couponDiscount
      ? couponDiscount.type === 'percent'
        ? subtotal * (couponDiscount.value / 100)
        : Math.min(couponDiscount.value, subtotal)
      : 0;
    const total = Math.max(0, subtotal - discount + tipAmount);
    const restaurant = { name: restaurantName || slug || 'Restaurante' };
    const receiptItems = items.length > 0 ? items : [{ name: 'Cuenta', quantity: 1, unitPrice: total, totalPrice: total }];
    const effectiveMethod =
      payMethod === 'card'
        ? 'Tarjeta'
        : payMethod === 'cash'
          ? 'Efectivo'
          : 'Sin método seleccionado';
    const payload = {
      restaurant,
      slug,
      mesaNumber: table,
      items: receiptItems,
      subtotal,
      discount,
      tipAmount: tipAmount || 0,
      total,
      paidAt: new Date().toISOString(),
      paymentMethod: effectiveMethod,
    };
    saveLastReceiptToStorage(payload);
  };

  // orderId para MP: último de openOrders, o último de orderDetails como fallback
  const lastOrderId = useMemo(() => {
    if (openOrders.length) return openOrders[openOrders.length - 1].id;
    if (orderDetails?.length) return orderDetails[orderDetails.length - 1]?.id;
    return null;
  }, [openOrders, orderDetails]);

  const showOrderBtn = items.length > 0;

  // ---------- Enviar pedido ----------
  const isSessionMesaError = (msg) =>
    typeof msg === 'string' && (msg.includes('mesa asociada') || msg.includes('sesión no tiene mesa'));

  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
      return;
    }
    if (!tableSessionId) {
      setSnack({
        open: true,
        msg: 'Sincronizando con la mesa… Esperá un segundo y volvé a intentar.',
        severity: 'warning',
      });
      return;
    }
    try {
      setSending(true);

      const payloadItems = items.map(i => ({
        productId: i.id,
        qty: i.qty,
        price: i.precio,
        notes: i.notes || ''
      }));

      const namePart = customerName.trim() ? `Cliente: ${customerName.trim()}\n` : '';
      const trimmedNotes = namePart + orderNotes.trim();
      const payload = { table, tableSessionId, items: payloadItems, notes: trimmedNotes };

      const maxAttempts = 3;
      const retryDelayMs = 500;
      let lastErr = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await createOrder(slug, payload);

          const createdId =
            res?.id ?? res?.data?.id ?? res?.data?.data?.id ?? res?.orderId ?? null;
          const totalFromRes =
            res?.total ??
            res?.data?.total ??
            res?.attributes?.total ??
            res?.data?.attributes?.total ??
            null;

          const recordedTotal = Number(totalFromRes ?? subtotal) || 0;

          if (slug && table) {
            const next = [...readOpenOrders(slug, table), { id: createdId, total: recordedTotal }];
            setOpenOrders(next);
            writeOpenOrders(slug, table, next);
          }

          clearCart();
          setSnack({ open: true, msg: 'Pedido enviado con éxito ✅', severity: 'success' });
          setConfirmOpen(false);
          setBackendHasAccount(true);
          return;
        } catch (err) {
          lastErr = err;
          const msg =
            err?.response?.data?.error?.message ??
            err?.message ??
            '';
          if (attempt < maxAttempts && isSessionMesaError(msg)) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
            continue;
          }
          throw err;
        }
      }

      throw lastErr;
    } catch (err) {
      console.error(err);
      const apiMsg =
        err?.response?.data?.error?.message ||
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(' | ')
          : err?.response?.data?.message) ||
        err?.message ||
        'Error al enviar el pedido ❌';
      const friendlyMsg = isSessionMesaError(apiMsg)
        ? 'Sincronizando con la mesa… Por favor, esperá un segundo y volvé a intentar.'
        : apiMsg;
      setSnack({ open: true, msg: friendlyMsg, severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!confirmOpen) {
      setOrderNotes('');
      setCustomerName('');
    }
  }, [confirmOpen]);

  // ---------- Llamar Mozo ----------
  const handleCallWaiter = async () => {
    try {
      setCallWaiterOpen(false);

      // Enviar "pedido" especial para notificar al mozo
      await createOrder(slug, {
        table,
        tableSessionId,
        items: [{
          productId: 'sys-waiter-call',
          name: '🔔 LLAMAR MOZO',
          price: 0,
          qty: 1
        }],
        notes: 'Solicitud de asistencia'
      });

      setSnack({
        open: true,
        msg: 'Mozo notificado. En breve se acercará a tu mesa. 🔔',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error calling waiter:', err);
      setSnack({
        open: true,
        msg: 'No se pudo notificar al mozo. Por favor intentá de nuevo.',
        severity: 'error'
      });
    }
  };

  const handlePayWithMercadoPago = async () => {
    try {
      setPayLoading(true);

      // Guardar recibo localmente antes de redirigir
      let itemsForReceipt = (orderDetails || []).flatMap((o) =>
        (o.items || []).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice ?? it.unitPrice * it.quantity,
        }))
      );
      if (itemsForReceipt.length === 0 && openOrders?.length > 0) {
        itemsForReceipt = openOrders.map((o, i) => ({
          name: `Pedido #${o.id || i + 1}`,
          quantity: 1,
          unitPrice: Number(o.total) || 0,
          totalPrice: Number(o.total) || 0,
        }));
      }
      const subtotalFromItems = itemsForReceipt.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
      const subtotalBase = subtotalFromItems > 0 ? subtotalFromItems : accountTotal;
      const discountBase = couponDiscount
        ? couponDiscount.type === 'percent'
          ? subtotalBase * (couponDiscount.value / 100)
          : Math.min(couponDiscount.value, subtotalBase)
        : 0;
      const totalBase = Math.max(0, subtotalBase - discountBase + tipAmount);
      const restaurantBase = { name: restaurantName || slug || 'Restaurante' };
      const receiptItemsBase =
        itemsForReceipt.length > 0
          ? itemsForReceipt
          : [{ name: 'Cuenta', quantity: 1, unitPrice: totalBase, totalPrice: totalBase }];

      saveLastReceiptToStorage({
        restaurant: restaurantBase,
        slug,
        mesaNumber: table,
        items: receiptItemsBase,
        subtotal: subtotalBase,
        discount: discountBase,
        tipAmount: tipAmount || 0,
        total: totalBase,
        paidAt: new Date().toISOString(),
        paymentMethod: 'Mercado Pago',
      });

      const data = await createMpPreference({
        orderId: lastOrderId,
        amount: totalBase,
        slug,
      });

      const url = data?.init_point;
      if (!url || typeof url !== 'string') {
        throw new Error('No se recibió el enlace de pago de Mercado Pago.');
      }

      window.location.href = url;
    } catch (err) {
      console.error(err);
      const msg =
        err?.message ||
        'No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.';
      setSnack({ open: true, msg, severity: 'error' });
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => {
    if (payMethod === 'card' && cardOptionsRef.current && isMobile) {
      cardOptionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [payMethod, isMobile]);

  // ---------- Inputs de tarjeta ----------
  const handleCardNumber = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 16);
    const parts = v.match(/.{1,4}/g) || [];
    setCard((c) => ({ ...c, number: parts.join(' ') }));
  };
  const handleExpiry = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    const formatted = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
    setCard((c) => ({ ...c, expiry: formatted }));
  };
  const handleCvv = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCard((c) => ({ ...c, cvv: v }));
  };
  const handleName = (e) => setCard((c) => ({ ...c, name: e.target.value }));

  // ---------- Validar cupón ----------
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setSnack({ open: true, msg: 'Ingresá un código de cupón', severity: 'warning' });
      return;
    }

    setValidatingCoupon(true);
    try {
      // Por ahora, validación simple en frontend
      // En producción, esto debería llamar a un endpoint del backend
      // const response = await api.post(`/restaurants/${slug}/coupons/validate`, { code: couponCode });

      // Simulación: aceptar códigos que empiecen con "DESC" o "PROMO"
      // En producción, reemplazar con llamada real al backend
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay

      const codeUpper = couponCode.trim().toUpperCase();

      // Ejemplo de validación (en producción esto viene del backend)
      let discount = null;
      if (codeUpper.startsWith('DESC10')) {
        discount = { type: 'percent', value: 10, code: couponCode.trim() };
      } else if (codeUpper.startsWith('DESC20')) {
        discount = { type: 'percent', value: 20, code: couponCode.trim() };
      } else if (codeUpper.startsWith('PROMO')) {
        discount = { type: 'fixed', value: 500, code: couponCode.trim() };
      } else {
        setSnack({ open: true, msg: 'Código de cupón inválido', severity: 'error' });
        setCouponCode('');
        return;
      }

      setCouponDiscount(discount);
      setSnack({
        open: true,
        msg: `Cupón aplicado: ${discount.value}${discount.type === 'percent' ? '%' : '$'} de descuento ✅`,
        severity: 'success'
      });
    } catch (err) {
      console.error('Error validando cupón:', err);
      setSnack({
        open: true,
        msg: 'Error al validar el cupón. Intentá de nuevo.',
        severity: 'error'
      });
    } finally {
      setValidatingCoupon(false);
    }
  };

  // ---------- Pagar cuenta ----------
  const handlePay = async () => {
    if (!payMethod) {
      setSnack({
        open: true,
        msg: 'Seleccioná un método de pago.',
        severity: 'warning',
      });
      return;
    }
    // Si es Mercado Pago, ya maneja su propio flujo (Wallet / Brick)
    if (payMethod === 'mp') {
      return;
    }

    // Flujo tarjeta: crear checkout de Mobbex y redirigir
    if (payMethod === 'card') {
      if (!cardType || !cardBrand) {
        setSnack({
          open: true,
          msg: 'Seleccioná tipo y marca de tarjeta (Crédito/Débito y Visa/Mastercard).',
          severity: 'warning',
        });
        return;
      }

      try {
        setPayLoading(true);

        // Usar el último pedido como referencia si existe, sino slug+mesa+timestamp
        const baseRef =
          lastOrderId != null
            ? String(lastOrderId)
            : `${slug || 'resto'}-${table || 'mesa'}-${Date.now()}`;

        const { checkoutUrl } = await createMobbexCheckout({
          total: totalWithTip,
          reference: baseRef,
          cardType,
          cardBrand: cardBrand || 'visa',
          slug,
          table,
          tableSessionId,
        });

        // Guardar recibo localmente antes de redirigir
        saveReceiptForDownload();

        // Redirigir al checkout hospedado de Mobbex
        window.location.href = checkoutUrl;
      } catch (err) {
        console.error(err);
        const msg =
          err?.message ||
          err?.toString?.() ||
          'No se pudo iniciar el pago con tarjeta (Mobbex). Intentá de nuevo.';
        setSnack({ open: true, msg, severity: 'error' });
      } finally {
        setPayLoading(false);
      }

      return;
    }

    try {
      setPayLoading(true);

      const methodNames = {
        cash: 'efectivo',
        card: 'tarjeta',
        mp: 'Mercado Pago',
      };

      // Si es efectivo, es pago presencial (solicitud de cobro)
      if (payMethod === 'cash') {
        // Prevenir múltiples solicitudes
        if (payRequestSent) {
          setSnack({
            open: true,
            msg: 'Ya se envió una solicitud de cobro. Por favor esperá a que el mozo se acerque.',
            severity: 'warning',
          });
          return;
        }

        // Para pago presencial, NO cerramos la cuenta aún. 
        // Enviamos una solicitud de cobro al mostrador.
        setPayRequestSent(true);
        try {
          await createOrder(slug, {
            table,
            tableSessionId,
            items: [{
              productId: 'sys-pay-request',
              name: '💳 SOLICITUD DE COBRO',
              price: 0,
              qty: 1,
              notes: `Pago con ${methodNames[payMethod] || 'Efectivo'}`
            }],
            notes: `Mesa ${table} solicita cobrar en ${methodNames[payMethod] || 'Efectivo'}`
          });

          setSnack({
            open: true,
            msg: `Solicitud enviada. Un mozo se acercará a cobrarte en ${methodNames[payMethod]}. ✅`,
            severity: 'success',
          });

          // No cerramos la cuenta localmente ni en backend, esperamos al mozo.
          setPayOpen(false);
          // Resetear form
          setPayMethod(null);
          setPayRequestSent(false); // Resetear después de un delay
          setTimeout(() => setPayRequestSent(false), 5000); // Permitir nueva solicitud después de 5 segundos

          // Redirigir a página de agradecimiento
          navigate(`/thank-you?type=presencial${slug ? `&slug=${slug}` : ''}`);
        } catch (err) {
          setPayRequestSent(false);
          throw err;
        }
      }
    } catch (err) {
      console.error(err);
      const apiMsg =
        err?.response?.data?.error?.message ||
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(' | ')
          : err?.response?.data?.message) ||
        err?.message ||
        'Error al pagar la cuenta ❌';
      setSnack({ open: true, msg: apiMsg, severity: 'error' });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 1300,
        }}
      >
        {/* Mesa + subtotal */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {table && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Chip label={`Mesa ${table}`} size="small" color="primary" variant="outlined" />
              <Tooltip title="Copiar link de mesa">
                <IconButton
                  size="small"
                  onClick={async () => {
                    const url = `${window.location.origin}/${slug}/menu?t=${table}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setSnack({ open: true, msg: 'Link copiado', severity: 'info' });
                    } catch {
                      setSnack({ open: true, msg: 'No se pudo copiar', severity: 'warning' });
                    }
                  }}
                  aria-label="Copiar link de mesa"
                >
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {showOrderBtn && (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                marginLeft: 'auto',
              }}
            >
              Subtotal: {money(subtotal)}
            </Typography>
          )}
        </Box>

        {/* Botones de acción: Enviar pedido / Mozo / Ver cuenta */}
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            gap: 1,
          }}
        >
          {showOrderBtn && (
            <Button
              fullWidth
              variant="contained"
              disabled={!sessionReady || !table || !tableSessionId}
              onClick={() => setConfirmOpen(true)}
              title={!sessionReady ? 'Preparando mesa…' : undefined}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                minHeight: 44,
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                px: 1,
              }}
            >
              {!sessionReady ? 'Preparando mesa…' : 'Enviar pedido'}
            </Button>
          )}

          <Button
            fullWidth
            variant="outlined"
            color="warning"
            onClick={() => setCallWaiterOpen(true)}
            startIcon={<RoomServiceIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              minHeight: 44,
              fontSize: { xs: '0.8rem', sm: '0.9rem' },
              px: 1,
              borderColor: 'warning.main',
              color: 'warning.main',
              '&:hover': {
                borderColor: 'warning.dark',
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.05),
              },
            }}
          >
            Mozo
          </Button>

          {backendHasAccount && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setPayOpen(true)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                minHeight: 44,
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                px: 1,
              }}
            >
              Ver Cuenta
            </Button>
          )}
        </Box>
      </Paper>

      {/* Diálogo Confirmar Llamar Mozo */}
      <Dialog
        open={callWaiterOpen}
        onClose={() => setCallWaiterOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RoomServiceIcon color="warning" />
          ¿Llamar al mozo?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Un mozo se acercará a tu mesa para ayudarte con lo que necesites.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCallWaiterOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleCallWaiter} variant="contained" color="warning">
            Llamar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación de pedido */}
      <Dialog
        open={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="confirm-order-title"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          id="confirm-order-title"
          sx={{
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider',
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Confirmar pedido
            </Typography>
            <Chip
              label={`${items.length} item${items.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ maxHeight: '60vh', overflowY: 'auto', p: 2 }}>
            <AnimatePresence>
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      py: 1.5,
                      px: 1.5,
                      mb: 1,
                      borderRadius: 2,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? alpha(theme.palette.primary.main, 0.03)
                          : alpha(theme.palette.primary.main, 0.08),
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          fontSize: '1rem',
                          lineHeight: 1.35,
                        }}
                      >
                        {item.qty}x {item.nombre}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                          mt: 0.25,
                        }}
                      >
                        {money(item.precio)} c/u
                      </Typography>
                    </Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        color: 'text.primary',
                        fontSize: '1rem',
                        flexShrink: 0,
                      }}
                    >
                      {money(item.precio * item.qty)}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>

            {items.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.primary.main, 0.05)
                        : alpha(theme.palette.primary.main, 0.1),
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Total
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: 'primary.main',
                    }}
                  >
                    {money(subtotal)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              label="Nombre (opcional)"
              placeholder="¿A nombre de quién es el pedido?"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Comentario para el mostrador (opcional)"
              placeholder="¿Querés avisar algo sobre tu pedido?"
              fullWidth
              multiline
              minRows={3}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              helperText="Se enviará junto con el pedido"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            display: 'flex',
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            p: 2,
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'light' ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.02)',
          }}
        >
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={sending}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
            }}
          >
            Cancelar
          </Button>
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          <Button
            onClick={() => {
              if (window.confirm('¿Vaciar el carrito?')) {
                clearCart();
                setConfirmOpen(false);
                setSnack({ open: true, msg: 'Carrito vaciado', severity: 'info' });
              }
            }}
            disabled={sending}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              color: 'text.secondary',
              flex: {
                xs: '1 1 calc(50% - 0.5rem)',
                sm: '0 0 auto',
              },
            }}
          >
            Vaciar carrito
          </Button>
          <Button
            variant="contained"
            onClick={handleSendOrder}
            disabled={sending || items.length === 0 || !table || !tableSessionId || !sessionReady}
            title={!sessionReady ? 'Preparando mesa…' : !tableSessionId ? 'Esperando sesión de mesa…' : undefined}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 4,
              fontWeight: 600,
              boxShadow: 3,
              flex: {
                xs: '1 1 calc(50% - 0.5rem)',
                sm: '0 0 auto',
              },
              '&:hover': {
                boxShadow: 5,
              },
            }}
          >
            {sending ? 'Enviando…' : !sessionReady ? 'Preparando mesa…' : !tableSessionId ? 'Esperando sesión…' : 'Confirmar pedido'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Modal de pago mejorado */}
      <Dialog
        open={payOpen}
        onClose={() => !payLoading && setPayOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="pay-account-title"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          id="pay-account-title"
          sx={{
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider',
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Tu Cuenta
            </Typography>
            {table && (
              <Chip label={`Mesa ${table}`} size="small" color="primary" variant="outlined" />
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {isMobile && (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {mobilePayStep === 1 ? (
                <>
                  <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      Resumen
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {orderDetails.length > 0 ? `${orderDetails.length} pedido(s)` : 'Cuenta abierta'}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1, fontWeight: 700 }}>
                      Subtotal: {money(orderDetails.length > 0 ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0) : accountTotal)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Propina (opcional)
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                      {[0, 10, 15, 20].map((percent) => (
                        <Button
                          key={percent}
                          variant={tipPercentage === percent ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => {
                            const baseTotal = orderDetails.length > 0
                              ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
                              : accountTotal;
                            const totalAfterDiscount = Math.max(0, baseTotal - couponDiscountAmount);
                            setTipPercentage(percent);
                            setTipAmount(percent > 0 ? Math.round((totalAfterDiscount * percent) / 100) : 0);
                          }}
                          sx={{ textTransform: 'none', minWidth: 0 }}
                        >
                          {percent}%
                        </Button>
                      ))}
                    </Box>
                  </Box>

                  <Box>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowMobileCoupon((v) => !v)}
                      sx={{ textTransform: 'none', px: 0 }}
                    >
                      {showMobileCoupon ? 'Ocultar cupón' : 'Tengo cupón'}
                    </Button>
                    {showMobileCoupon && !couponDiscount && (
                      <>
                        <TextField
                          fullWidth
                          size="small"
                          label="Código de cupón"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          sx={{ mt: 1 }}
                        />
                        <Button
                          fullWidth
                          size="small"
                          onClick={handleValidateCoupon}
                          disabled={!couponCode.trim() || validatingCoupon}
                          sx={{ mt: 1, textTransform: 'none' }}
                        >
                          {validatingCoupon ? 'Validando...' : 'Aplicar cupón'}
                        </Button>
                      </>
                    )}
                    {couponDiscount && (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                        Cupón aplicado: -{money(couponDiscountAmount)}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      Total: {money(totalWithTip)}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => setMobilePayStep(2)}
                    sx={{ textTransform: 'none' }}
                  >
                    Continuar al pago
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setPayOpen(false);
                      setTipAmount(0);
                      setTipPercentage(0);
                    }}
                    sx={{ textTransform: 'none', mt: 0.5 }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Método de pago
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handlePayWithMercadoPago}
                      disabled={payLoading}
                      sx={{ textTransform: 'none' }}
                    >
                      MP
                    </Button>
                    <Button
                      size="small"
                      variant={payMethod === 'card' ? 'contained' : 'outlined'}
                      onClick={() => setPayMethod('card')}
                      sx={{ textTransform: 'none' }}
                    >
                      Tarjeta
                    </Button>
                    <Button
                      size="small"
                      variant={payMethod === 'cash' ? 'contained' : 'outlined'}
                      onClick={() => setPayMethod('cash')}
                      sx={{ textTransform: 'none' }}
                    >
                      Efectivo
                    </Button>
                  </Box>

                  {payMethod === 'card' && (
                    <Box
                      sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}
                      ref={cardOptionsRef}
                    >
                      <Button variant={cardType === 'credit' ? 'contained' : 'outlined'} onClick={() => setCardType('credit')} sx={{ textTransform: 'none' }}>
                        Crédito
                      </Button>
                      <Button variant={cardType === 'debit' ? 'contained' : 'outlined'} onClick={() => setCardType('debit')} sx={{ textTransform: 'none' }}>
                        Débito
                      </Button>
                    </Box>
                  )}

                  {payMethod === 'cash' && (
                    <Typography variant="body2" color="text.secondary">
                      Se enviará una solicitud al staff para cobrar en mesa.
                    </Typography>
                  )}

                  {payMethod === 'card' && (
                    <Box
                      sx={{
                        mt: 1,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 1,
                      }}
                    >
                      <Button
                        variant={cardBrand === 'visa' ? 'contained' : 'outlined'}
                        onClick={() => setCardBrand('visa')}
                        sx={{ textTransform: 'none' }}
                      >
                        Visa
                      </Button>
                      <Button
                        variant={cardBrand === 'mastercard' ? 'contained' : 'outlined'}
                        onClick={() => setCardBrand('mastercard')}
                        sx={{ textTransform: 'none' }}
                      >
                        Mastercard
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}

          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          {/* Resumen detallado de pedidos */}
          <Box sx={{ maxHeight: '50vh', overflowY: 'auto', p: 2 }}>
            {loadingOrders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : orderDetails.length === 0 && accountTotal === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay pedidos para pagar
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
                  Resumen de pedidos
                </Typography>
                {orderDetails.length === 0 && accountTotal > 0 && (
                  <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Total acumulado: {money(accountTotal)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      No se pudieron cargar los detalles de los pedidos. El total se calculará correctamente.
                    </Typography>
                  </Box>
                )}
                <AnimatePresence>
                  {(orderDetails.length > 0 ? orderDetails : []).map((order, orderIndex) => {
                    return (
                      <motion.div
                        key={order.id || `order-${orderIndex}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: orderIndex * 0.1 }}
                      >
                        <Box
                          sx={{
                            mb: 2,
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: (theme) =>
                              theme.palette.mode === 'light'
                                ? alpha(theme.palette.primary.main, 0.03)
                                : alpha(theme.palette.primary.main, 0.08),
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Pedido #{order.id || orderIndex + 1}
                            </Typography>
                            {order.createdAt && (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(order.createdAt).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Typography>
                            )}
                          </Box>

                          {/* Estado del pedido */}
                          <Box sx={{ mb: 1.5 }}>
                            <Chip
                              label={getStatusLabel(order.order_status)}
                              color={getStatusColor(order.order_status)}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>

                          {/* Items del pedido */}
                          {order.items && order.items.length > 0 ? (
                            <Box sx={{ mt: 1.5 }}>
                              {order.items.map((item, itemIndex) => (
                                <Box
                                  key={item.id || `item-${itemIndex}`}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    mb: 1,
                                    pb: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    '&:last-child': {
                                      borderBottom: 'none',
                                      mb: 0,
                                      pb: 0,
                                    },
                                  }}
                                >
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {item.name || 'Producto'}
                                    </Typography>
                                    {item.notes && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                        Nota: {item.notes}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box sx={{ textAlign: 'right', ml: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      {item.quantity || 1} × {money(item.unitPrice || item.totalPrice || 0)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {money(item.totalPrice || item.unitPrice || 0)}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                              Sin items detallados
                            </Typography>
                          )}

                          {order.customerNotes && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" color="text.secondary">
                                Nota del pedido: {order.customerNotes}
                              </Typography>
                            </Box>
                          )}

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Subtotal pedido
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {money(order.total)}
                            </Typography>
                          </Box>
                        </Box>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </Box>
            )}
          </Box>

          {/* Totales y propina */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.02) }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body1">Subtotal</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {money(
                  orderDetails.length > 0
                    ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
                    : accountTotal
                )}
              </Typography>
            </Box>

            {/* Cupón de descuento */}
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Cupón de descuento
              </Typography>
              {!couponDiscount ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Código de cupón"
                    placeholder="Ingresá tu código"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={validatingCoupon}
                    sx={{ flex: 1 }}
                    InputProps={{
                      endAdornment: (
                        <IconButton
                          size="small"
                          onClick={handleValidateCoupon}
                          disabled={!couponCode.trim() || validatingCoupon}
                          sx={{ mr: -1 }}
                        >
                          {validatingCoupon ? (
                            <CircularProgress size={20} />
                          ) : (
                            <LocalOfferIcon />
                          )}
                        </IconButton>
                      ),
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'success.light',
                    border: '1px solid',
                    borderColor: 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ color: 'success.main' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Cupón: {couponDiscount.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {couponDiscount.value}{couponDiscount.type === 'percent' ? '%' : '$'} de descuento
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCouponDiscount(null);
                      setCouponCode('');
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <CancelIcon />
                  </IconButton>
                </Box>
              )}
            </Box>

            {/* Mostrar descuento aplicado */}
            {couponDiscountAmount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  Descuento ({couponDiscount.code})
                </Typography>
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  -{money(couponDiscountAmount)}
                </Typography>
              </Box>
            )}

            {/* Propina */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Propina (opcional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {[0, 10, 15, 20].map((percent) => (
                  <Button
                    key={percent}
                    variant={tipPercentage === percent ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      const baseTotal = orderDetails.length > 0
                        ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
                        : accountTotal;
                      const totalAfterDiscount = Math.max(0, baseTotal - couponDiscountAmount);
                      setTipPercentage(percent);
                      setTipAmount(percent > 0 ? Math.round((totalAfterDiscount * percent) / 100) : 0);
                    }}
                    sx={{ flex: 1, textTransform: 'none' }}
                  >
                    {percent}%
                  </Button>
                ))}
              </Box>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Propina personalizada"
                placeholder="0"
                value={tipAmount > 0 && tipPercentage === 0 ? tipAmount : ''}
                onChange={(e) => {
                  const value = Number(e.target.value) || 0;
                  setTipAmount(value);
                  setTipPercentage(0);
                }}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
                sx={{ mt: 1 }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Desglose del total */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Subtotal
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {money(
                    orderDetails.length > 0
                      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
                      : accountTotal
                  )}
                </Typography>
              </Box>
              {couponDiscountAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="success.main">
                    Descuento ({couponDiscount.code})
                  </Typography>
                  <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                    -{money(couponDiscountAmount)}
                  </Typography>
                </Box>
              )}
              {tipAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Propina {tipPercentage > 0 ? `(${tipPercentage}%)` : ''}
                  </Typography>
                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                    {money(tipAmount)}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Total a pagar
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: 'primary.main',
                  }}
                >
                  {money(totalWithTip)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Método de pago */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Método de pago
            </Typography>

            {/* Opciones de pago directas: Mercado Pago, Tarjeta, Efectivo */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AttachMoneyIcon />}
                onClick={handlePayWithMercadoPago}
                disabled={payLoading}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  py: 1.5,
                  color: '#2196F3',
                  borderColor: '#2196F3',
                  '&:hover': {
                    bgcolor: alpha('#2196F3', 0.1),
                    borderColor: '#0b7dda',
                  },
                }}
              >
                Mercado Pago
              </Button>
              <Button
                fullWidth
                variant={payMethod === 'card' ? 'contained' : 'outlined'}
                startIcon={<CreditCardIcon />}
                onClick={() => setPayMethod('card')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  py: 1.5,
                  bgcolor: payMethod === 'card' ? '#2196F3' : undefined,
                  color: payMethod === 'card' ? 'white' : '#2196F3',
                  borderColor: '#2196F3',
                  '&:hover': {
                    bgcolor: payMethod === 'card' ? '#0b7dda' : alpha('#2196F3', 0.1),
                    borderColor: '#0b7dda',
                  },
                }}
              >
                Tarjeta
              </Button>
              <Button
                fullWidth
                variant={payMethod === 'cash' ? 'contained' : 'outlined'}
                startIcon={<AttachMoneyIcon />}
                onClick={() => setPayMethod('cash')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  py: 1.5,
                  bgcolor: payMethod === 'cash' ? '#4CAF50' : undefined,
                  color: payMethod === 'cash' ? 'white' : '#4CAF50',
                  borderColor: '#4CAF50',
                  '&:hover': {
                    bgcolor: payMethod === 'cash' ? '#45a049' : alpha('#4CAF50', 0.1),
                    borderColor: '#45a049',
                  },
                }}
              >
                Efectivo
              </Button>
            </Box>

            {/* Selección de tarjeta cuando se elige "Tarjeta" */}
            {payMethod === 'card' && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }} ref={cardOptionsRef}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tipo de tarjeta
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Button
                      fullWidth
                      variant={cardType === 'credit' ? 'contained' : 'outlined'}
                      onClick={() => setCardType('credit')}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        py: 1,
                      }}
                    >
                      Crédito
                    </Button>
                    <Button
                      fullWidth
                      variant={cardType === 'debit' ? 'contained' : 'outlined'}
                      onClick={() => setCardType('debit')}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        py: 1,
                      }}
                    >
                      Débito
                    </Button>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Marca de tarjeta
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Button
                      fullWidth
                      variant={cardBrand === 'visa' ? 'contained' : 'outlined'}
                      onClick={() => setCardBrand('visa')}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        py: 1,
                      }}
                    >
                      Visa
                    </Button>
                    <Button
                      fullWidth
                      variant={cardBrand === 'mastercard' ? 'contained' : 'outlined'}
                      onClick={() => setCardBrand('mastercard')}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        py: 1,
                      }}
                    >
                      Mastercard
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Mensaje para pago con efectivo */}
            {payMethod === 'cash' && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1, border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="body2" color="info.main" align="center">
                  Se enviará una solicitud de cobro. Un mozo se acercará a tu mesa para recibir el pago en efectivo.
                </Typography>
              </Box>
            )}
          </Box>
          </Box>
        </DialogContent>

        {!(isMobile && mobilePayStep === 1) && (
          <DialogActions
            sx={{
              p: 2,
              gap: 1,
              borderTop: 1,
              borderColor: 'divider',
              backgroundColor: (theme) =>
                theme.palette.mode === 'light' ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.02)',
            }}
          >
            {isMobile && mobilePayStep === 2 && (
              <Button
                onClick={() => setMobilePayStep(1)}
                disabled={payLoading}
                sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
              >
                Volver
              </Button>
            )}
            <Button
              onClick={() => {
                setPayOpen(false);
                setTipAmount(0);
                setTipPercentage(0);
              }}
              disabled={payLoading}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handlePay}
              disabled={
                payLoading ||
                payRequestSent ||
                (orderDetails.length === 0 && accountTotal === 0) ||
                !payMethod ||
                (payMethod === 'card' && (!cardType || !cardBrand))
              }
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                px: 4,
                fontWeight: 600,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 5,
                },
              }}
            >
              {payLoading
                ? 'Procesando…'
                : payRequestSent
                  ? 'Solicitud enviada'
                  : payMethod === 'cash'
                    ? 'Solicitar Cobro'
                    : `Pagar ${money(totalWithTip)}`
              }
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}
