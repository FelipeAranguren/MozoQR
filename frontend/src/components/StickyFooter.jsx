// frontend/src/components/StickyFooter.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField, Tabs, Tab, Divider, Chip, CircularProgress, IconButton
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, closeAccount, hasOpenAccount, fetchOrderDetails } from '../api/tenant';
import QtyStepper from './QtyStepper';
import PayWithMercadoPago from './PayWithMercadoPago';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

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

export default function StickyFooter({ table, tableSessionId }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payType, setPayType] = useState('presential'); // 'presential' | 'online'
  const [payMethod, setPayMethod] = useState('cash'); // 'cash' | 'card' para presential, 'card' | 'mp' para online
  const [payLoading, setPayLoading] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [orderDetails, setOrderDetails] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(0);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Estado "oficial" de si hay cuenta abierta (desde backend)
  const [backendHasAccount, setBackendHasAccount] = useState(false);

  // Registro local de pedidos abiertos y sus totales (sólo para mostrar el total en UI)
  const [openOrders, setOpenOrders] = useState([]);

  // Carga inicial de estado local y consulta al backend
  useEffect(() => {
    let cancelled = false;

    // Cargar lista local de pedidos abiertos (para total)
    if (!slug || !table) {
      setOpenOrders([]);
    } else {
      setOpenOrders(readOpenOrders(slug, table));
    }

    // Consultar al backend si hay cuenta abierta (para mostrar botón pagar)
    (async () => {
      if (!slug || !table) {
        if (!cancelled) setBackendHasAccount(false);
        return;
      }
      try {
        const exists = await hasOpenAccount(slug, { table, tableSessionId });
        if (!cancelled) setBackendHasAccount(Boolean(exists));
      } catch {
        if (!cancelled) setBackendHasAccount(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug, table, tableSessionId]);

  // Total mostrado en el modal de pago (suma de pedidos registrados localmente)
  const accountTotal = useMemo(
    () => openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
    [openOrders]
  );

  // Total con propina (usar orderDetails si está disponible, sino accountTotal)
  const totalWithTip = useMemo(() => {
    const baseTotal = orderDetails.length > 0
      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      : accountTotal;
    return baseTotal + tipAmount;
  }, [accountTotal, tipAmount, orderDetails]);

  // Cargar detalles de pedidos cuando se abre el modal de pago
  useEffect(() => {
    if (payOpen && slug && table) {
      setLoadingOrders(true);
      fetchOrderDetails(slug, { table, tableSessionId })
        .then((orders) => {
          console.log('✅ Order details loaded:', orders);
          console.log('✅ Orders count:', orders.length);
          orders.forEach((order, idx) => {
            console.log(`✅ Order ${idx + 1}:`, {
              id: order.id,
              total: order.total,
              itemsCount: order.items?.length || 0,
              items: order.items,
            });
          });
          setOrderDetails(orders);
          // Calcular total desde los pedidos detallados
          const calculatedTotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
          console.log('✅ Calculated total from orders:', calculatedTotal);
          // Actualizar propina basada en el nuevo total
          if (tipPercentage > 0) {
            setTipAmount((calculatedTotal * tipPercentage) / 100);
          }
        })
        .catch((err) => {
          console.error('❌ Error loading order details:', err);
          console.error('❌ Error response:', err?.response?.data);
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
      setPayType('presential');
      setPayMethod('cash');
    }
  }, [payOpen, slug, table, tableSessionId, tipPercentage]);

  // Resetear propina cuando cambia el total (usar orderDetails si está disponible)
  useEffect(() => {
    const currentTotal = orderDetails.length > 0
      ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      : accountTotal;

    if (tipPercentage > 0 && currentTotal > 0) {
      setTipAmount((currentTotal * tipPercentage) / 100);
    }
  }, [accountTotal, tipPercentage, orderDetails]);

  // Tomamos el ÚLTIMO pedido abierto como referencia (orderId) para la preferencia
  const lastOrderId = useMemo(
    () => (openOrders.length ? openOrders[openOrders.length - 1].id : null),
    [openOrders]
  );

  const showOrderBtn = items.length > 0;

  // ---------- Enviar pedido ----------
  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
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

      const trimmedNotes = orderNotes.trim();
      const res = await createOrder(slug, {
        table,
        tableSessionId,
        items: payloadItems,
        notes: trimmedNotes,
      });

      const createdId =
        res?.id ?? res?.data?.id ?? res?.data?.data?.id ?? res?.orderId ?? null;
      const totalFromRes =
        res?.total ??
        res?.data?.total ??
        res?.attributes?.total ??
        res?.data?.attributes?.total ??
        null;

      // Si no viene total del backend, usamos el subtotal local del carrito
      const recordedTotal = Number(totalFromRes ?? subtotal) || 0;

      // Guardamos en el storage local para poder mostrar el total acumulado al pagar
      if (slug && table) {
        const next = [...readOpenOrders(slug, table), { id: createdId, total: recordedTotal }];
        setOpenOrders(next);
        writeOpenOrders(slug, table, next);
      }

      clearCart();
      setSnack({ open: true, msg: 'Pedido enviado con éxito ✅', severity: 'success' });
      setConfirmOpen(false);
      setBackendHasAccount(true); // probablemente ahora haya cuenta abierta
    } catch (err) {
      console.error(err);
      const apiMsg =
        err?.response?.data?.error?.message ||
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(' | ')
          : err?.response?.data?.message) ||
        err?.message ||
        'Error al enviar el pedido ❌';
      setSnack({ open: true, msg: apiMsg, severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!confirmOpen) {
      setOrderNotes('');
    }
  }, [confirmOpen]);

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

  // ---------- Pagar cuenta ----------
  const handlePay = async () => {
    // Validar tarjeta si es necesario (SOLO si es online)
    if (payType === 'online' && payMethod === 'card') {
      const { number, expiry, cvv, name } = card;
      const numOk = /^\d{4} \d{4} \d{4} \d{4}$/.test(number);
      const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
      const cvvOk = /^\d{3}$/.test(cvv);
      const nameOk = name.trim().length > 0;
      if (!numOk || !expOk || !cvvOk || !nameOk) {
        setSnack({ open: true, msg: 'Datos de tarjeta inválidos', severity: 'error' });
        return;
      }
    }

    // Si es Mercado Pago online, ya maneja su propio flujo
    if (payType === 'online' && payMethod === 'mp') {
      // El componente PayWithMercadoPago maneja su propio flujo
      return;
    }

    try {
      setPayLoading(true);

      // Cierre de cuenta
      await closeAccount(slug, { table, tableSessionId });

      // Limpiamos la lista local (ya no hay pedidos abiertos)
      if (slug && table) {
        clearOpenOrders(slug, table);
        setOpenOrders([]);
      }

      // Resetear propina
      setTipAmount(0);
      setTipPercentage(0);

      const methodNames = {
        cash: 'efectivo',
        card: payType === 'presential' ? 'tarjeta presencial' : 'tarjeta online',
        mp: 'Mercado Pago',
      };

      setSnack({
        open: true,
        msg: `Cuenta pagada con ${methodNames[payMethod] || 'tarjeta'} ${tipAmount > 0 ? `(+${money(tipAmount)} propina)` : ''} ✅`,
        severity: 'success',
      });
      setPayOpen(false);
      setBackendHasAccount(false);
      setPayType('presential');
      setPayMethod('cash');
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
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 1300,
          justifyContent: showOrderBtn ? 'flex-start' : 'flex-end',
        }}
      >
        {showOrderBtn && (
          <>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Subtotal: {money(subtotal)}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => setConfirmOpen(true)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Enviar pedido
            </Button>
          </>
        )}
        {backendHasAccount && (
          <Button
            variant="outlined"
            size="large"
            onClick={() => setPayOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Cerrar y pagar cuenta
          </Button>
        )}
      </Paper>

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
                      p: 2,
                      mb: 1,
                      borderRadius: 2,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? alpha(theme.palette.primary.main, 0.03)
                          : alpha(theme.palette.primary.main, 0.08),
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'light'
                            ? alpha(theme.palette.primary.main, 0.05)
                            : alpha(theme.palette.primary.main, 0.12),
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          mb: 0.5,
                          fontSize: '1rem',
                        }}
                      >
                        {item.nombre}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.875rem',
                          }}
                        >
                          {money(item.precio)} c/u
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          ×
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: 'primary.main',
                          }}
                        >
                          {item.qty}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: 'text.primary',
                            ml: 'auto',
                            fontSize: '1rem',
                          }}
                        >
                          {money(item.precio * item.qty)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ ml: 2 }}>
                      <QtyStepper
                        value={item.qty}
                        onAdd={() => addItem(item)}
                        onSub={() => removeItem(item.id)}
                      />
                    </Box>
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
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSendOrder}
            disabled={sending || items.length === 0}
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
            {sending ? 'Enviando…' : 'Confirmar pedido'}
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
              Pagar cuenta
            </Typography>
            {table && (
              <Chip label={`Mesa ${table}`} size="small" color="primary" variant="outlined" />
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
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
                    console.log('Rendering order:', order.id, 'with items:', order.items?.length || 0, order.items);
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
                      const currentTotal = orderDetails.length > 0
                        ? orderDetails.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
                        : accountTotal;
                      setTipPercentage(percent);
                      setTipAmount(percent > 0 ? (currentTotal * percent) / 100 : 0);
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

            {/* Primero: Tipo de pago (Presencial u Online) */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                fullWidth
                variant={payType === 'presential' ? 'contained' : 'outlined'}
                startIcon={<PointOfSaleIcon />}
                onClick={() => {
                  setPayType('presential');
                  setPayMethod('cash'); // Resetear a efectivo por defecto
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  py: 1.5,
                  bgcolor: payType === 'presential' ? '#4CAF50' : undefined,
                  color: payType === 'presential' ? 'white' : undefined,
                  borderColor: payType === 'presential' ? '#4CAF50' : undefined,
                  '&:hover': {
                    bgcolor: payType === 'presential' ? '#45a049' : undefined,
                    borderColor: payType === 'presential' ? '#45a049' : undefined,
                  },
                }}
              >
                Presencial
              </Button>
              <Button
                fullWidth
                variant={payType === 'online' ? 'contained' : 'outlined'}
                startIcon={<CreditCardIcon />}
                onClick={() => {
                  setPayType('online');
                  setPayMethod('card'); // Resetear a tarjeta por defecto
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  py: 1.5,
                  bgcolor: payType === 'online' ? '#2196F3' : undefined,
                  color: payType === 'online' ? 'white' : undefined,
                  borderColor: payType === 'online' ? '#2196F3' : undefined,
                  '&:hover': {
                    bgcolor: payType === 'online' ? '#0b7dda' : undefined,
                    borderColor: payType === 'online' ? '#0b7dda' : undefined,
                  },
                }}
              >
                Online
              </Button>
            </Box>

            {/* Segundo: Método específico según el tipo */}
            {payType === 'presential' && (
              <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
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
                <Button
                  fullWidth
                  variant={payMethod === 'card' ? 'contained' : 'outlined'}
                  startIcon={<CreditCardIcon />}
                  onClick={() => setPayMethod('card')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.5,
                    bgcolor: payMethod === 'card' ? '#4CAF50' : undefined,
                    color: payMethod === 'card' ? 'white' : '#4CAF50',
                    borderColor: '#4CAF50',
                    '&:hover': {
                      bgcolor: payMethod === 'card' ? '#45a049' : alpha('#4CAF50', 0.1),
                      borderColor: '#45a049',
                    },
                  }}
                >
                  Tarjeta
                </Button>
              </Box>
            )}

            {payType === 'online' && (
              <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
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
                  variant={payMethod === 'mp' ? 'contained' : 'outlined'}
                  startIcon={<AttachMoneyIcon />}
                  onClick={() => setPayMethod('mp')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.5,
                    bgcolor: payMethod === 'mp' ? '#2196F3' : undefined,
                    color: payMethod === 'mp' ? 'white' : '#2196F3',
                    borderColor: '#2196F3',
                    '&:hover': {
                      bgcolor: payMethod === 'mp' ? '#0b7dda' : alpha('#2196F3', 0.1),
                      borderColor: '#0b7dda',
                    },
                  }}
                >
                  Mercado Pago
                </Button>
              </Box>
            )}

            {/* Formulario de tarjeta SOLO cuando se selecciona tarjeta ONLINE */}
            {payType === 'online' && payMethod === 'card' && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Número de tarjeta"
                  fullWidth
                  margin="dense"
                  value={card.number}
                  onChange={handleCardNumber}
                  placeholder="1234 5678 9012 3456"
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    label="CVV"
                    margin="dense"
                    value={card.cvv}
                    onChange={handleCvv}
                    placeholder="123"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Vencimiento"
                    margin="dense"
                    value={card.expiry}
                    onChange={handleExpiry}
                    placeholder="MM/AA"
                    sx={{ flex: 1 }}
                  />
                </Box>
                <TextField
                  label="Nombre del titular"
                  fullWidth
                  margin="dense"
                  value={card.name}
                  onChange={handleName}
                />
              </Box>
            )}

            {/* Mensaje para pago presencial con tarjeta */}
            {payType === 'presential' && payMethod === 'card' && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1, border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="body2" color="info.main" align="center">
                  Solicitá el posnet al mozo para realizar el pago con tarjeta en la mesa.
                </Typography>
              </Box>
            )}

            {/* Mercado Pago cuando se selecciona online + MP */}
            {payType === 'online' && payMethod === 'mp' && (
              <Box sx={{ mt: 2 }}>
                <PayWithMercadoPago
                  orderId={lastOrderId}
                  amount={totalWithTip}
                  label="Pagar con Mercado Pago"
                  fullWidth
                />
              </Box>
            )}
          </Box>
        </DialogContent>

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
              (orderDetails.length === 0 && accountTotal === 0) ||
              (payType === 'online' && payMethod === 'card' && (!card.number || !card.expiry || !card.cvv || !card.name))
            }
            sx={{
              display: (payType === 'online' && payMethod === 'mp') ? 'none' : 'inline-flex',
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
            {payLoading ? 'Pagando…' : `Pagar ${money(totalWithTip)}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
