// src/components/StickyFooter.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, closeAccount, hasOpenAccount } from '../api/tenant'; // ✅ usa tus APIs que funcionaban
import QtyStepper from './QtyStepper';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

// --- Claves de storage (para acumular totales de pedidos abiertos por mesa y restaurante)
const openOrdersKey = (slug, table) => `OPEN_ORDERS_${slug}_${table}`; // lista [{id,total}]

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
  const [payLoading, setPayLoading] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });

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

  const showOrderBtn = items.length > 0;

  // ---------- Enviar pedido ----------
  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
      return;
    }
    try {
      setSending(true);

      // ✅ Usa la forma que funcionaba en tu backend (del archivo "viejo")
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
      // Intentamos rescatar id/total si vinieran en la respuesta (soporta varios shapes)
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

  // ---------- Inputs de tarjeta (mock UI) ----------
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

  // ---------- Pagar cuenta completa ----------
  const handlePay = async () => {
    const { number, expiry, cvv, name } = card;
    const numOk = /^\d{4} \d{4} \d{4} \d{4}$/.test(number);
    const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
    const cvvOk = /^\d{3}$/.test(cvv);
    const nameOk = name.trim().length > 0;
    if (!numOk || !expOk || !cvvOk || !nameOk) {
      setSnack({ open: true, msg: 'Datos de tarjeta inválidos', severity: 'error' });
      return;
    }

    try {
      setPayLoading(true);

      // ✅ Usa el cierre de cuenta de tu backend que ya funcionaba
      await closeAccount(slug, { table, tableSessionId });

      // Limpiamos la lista local (ya no hay pedidos abiertos)
      if (slug && table) {
        clearOpenOrders(slug, table);
        setOpenOrders([]);
      }

      setSnack({ open: true, msg: 'Cuenta pagada con éxito ✅', severity: 'success' });
      setPayOpen(false);
      setBackendHasAccount(false);
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
        aria-labelledby="confirm-order-title"
      >
        <DialogTitle id="confirm-order-title">Confirmar pedido</DialogTitle>
        <DialogContent dividers>
          <List>
            {items.map(item => (
              <ListItem
                key={item.id}
                secondaryAction={
                  <QtyStepper
                    value={item.qty}
                    onAdd={() => addItem(item)}
                    onSub={() => removeItem(item.id)}
                  />
                }
              >
                <ListItemText
                  primary={item.nombre}
                  secondary={money(item.precio * item.qty)}
                />
              </ListItem>
            ))}
          </List>
          <TextField
            label="Comentario para el mostrador (opcional)"
            placeholder="¿Querés avisar algo sobre tu pedido?"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            value={orderNotes}
            onChange={e => setOrderNotes(e.target.value)}
            helperText="Se enviará junto con el pedido"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={sending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSendOrder}
            disabled={sending || items.length === 0}
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

      {/* Modal de pago */}
      <Dialog
        open={payOpen}
        onClose={() => !payLoading && setPayOpen(false)}
        fullWidth
        aria-labelledby="pay-account-title"
      >
        <DialogTitle id="pay-account-title">Pagar cuenta</DialogTitle>
        <DialogContent dividers>
          {/* Total de la cuenta (suma local de pedidos abiertos) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1">Total</Typography>
            <Typography variant="subtitle1" sx={{ textAlign: 'right', fontWeight: 600 }}>
              {money(accountTotal)}
            </Typography>
          </Box>

          <TextField
            label="Número de tarjeta"
            fullWidth
            margin="dense"
            value={card.number}
            onChange={handleCardNumber}
            placeholder="1234 5678 9012 3456"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
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
            onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)} disabled={payLoading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handlePay} disabled={payLoading}>
            {payLoading ? 'Pagando…' : 'Pagar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
