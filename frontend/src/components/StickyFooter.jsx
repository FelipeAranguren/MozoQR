// src/components/StickyFooter.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, postPayment } from '../http'; // ⬅️ http.js
import QtyStepper from './QtyStepper';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

// === Keys ===
const lastOrderKey = (slug, table) => `LAST_ORDER_${slug}_${table}`;                // legacy (1 solo id)
const lastOrderTotalKey = (slug, table) => `LAST_ORDER_TOTAL_${slug}_${table}`;     // legacy (1 solo total)
const openOrdersKey = (slug, table) => `OPEN_ORDERS_${slug}_${table}`;              // nuevo: lista [{id,total}]

// Helpers de storage
const readOpenOrders = (slug, table) => {
  try {
    const raw = localStorage.getItem(openOrdersKey(slug, table));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const writeOpenOrders = (slug, table, arr) => {
  localStorage.setItem(openOrdersKey(slug, table), JSON.stringify(arr || []));
};
const clearOpenOrders = (slug, table) => {
  localStorage.removeItem(openOrdersKey(slug, table));
};

// Migra desde el esquema legacy (si existiera) a la nueva lista
const migrateLegacyToList = (slug, table) => {
  const legacyId = localStorage.getItem(lastOrderKey(slug, table));
  const legacyTot = localStorage.getItem(lastOrderTotalKey(slug, table));
  if (legacyId && !localStorage.getItem(openOrdersKey(slug, table))) {
    const id = Number(legacyId);
    const total = Number(legacyTot || 0);
    writeOpenOrders(slug, table, id ? [{ id, total }] : []);
  }
  localStorage.removeItem(lastOrderKey(slug, table));
  localStorage.removeItem(lastOrderTotalKey(slug, table));
};

export default function StickyFooter({ table, tableSessionId }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Lista de pedidos abiertos en esta mesa: [{id,total}]
  const [openOrders, setOpenOrders] = useState([]);

  // Carga inicial (y migración si venís del esquema viejo)
  useEffect(() => {
    if (!slug || !table) {
      setOpenOrders([]);
      return;
    }
    migrateLegacyToList(slug, table);
    setOpenOrders(readOpenOrders(slug, table));
  }, [slug, table]);

  const hasAccount = openOrders.length > 0;
  const accountTotal = useMemo(
    () => openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
    [openOrders]
  );

  const showOrderBtn = items.length > 0;

  // ========== Enviar pedido ==========
  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
      return;
    }
    try {
      setLoading(true);

      // Shape requerido por el backend
      const payloadItems = items.map(i => ({
        productId: i.id,
        quantity: i.qty,
        qty: i.qty,
        price: i.precio,
        UnitPrice: i.precio,
        notes: i.notes || null,
      }));

      const res = await createOrder(slug, { table, items: payloadItems });

      // id del pedido creado
      const createdId = res?.id || res?.data?.id;
      if (createdId) {
        // Si el backend devolvió total, lo usamos; si no, usamos el subtotal local
        const t =
          res?.total ??
          res?.data?.total ??
          res?.attributes?.total ??
          res?.data?.attributes?.total ??
          subtotal;

        const next = [...openOrders, { id: createdId, total: Number(t) || 0 }];
        setOpenOrders(next);
        writeOpenOrders(slug, table, next);
      }

      clearCart();
      setSnack({ open: true, msg: 'Pedido enviado con éxito ✅', severity: 'success' });
      setOpen(false);
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
      setLoading(false);
    }
  };

  // Inputs tarjeta (mock UI)
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

  // ========== Pagar cuenta (todos los pedidos abiertos) ==========
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
    if (openOrders.length === 0) {
      setSnack({ open: true, msg: 'No hay pedidos abiertos para pagar.', severity: 'error' });
      return;
    }

    try {
      setPayLoading(true);

      // Pagar en secuencia cada pedido abierto
      for (const o of openOrders) {
        await postPayment(slug, {
          orderId: o.id,
          status: 'approved',
          amount: undefined, // el backend usa el total del pedido
          provider: 'mock',
          externalRef: null,
        });
      }

      // Ok ⇒ limpiar cuenta abierta
      clearOpenOrders(slug, table);
      setOpenOrders([]);

      setSnack({ open: true, msg: 'Cuenta pagada con éxito ✅', severity: 'success' });
      setPayOpen(false);
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
          justifyContent: items.length > 0 ? 'flex-start' : 'flex-end',
        }}
      >
        {items.length > 0 && (
          <>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Subtotal: {money(subtotal)}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => setOpen(true)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Enviar pedido
            </Button>
          </>
        )}
        {hasAccount && (
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
        open={open}
        onClose={() => !loading && setOpen(false)}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSendOrder}
            disabled={loading || items.length === 0}
          >
            {loading ? 'Enviando…' : 'Confirmar pedido'}
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
          {/* Total de la cuenta (suma de todos los pedidos abiertos) */}
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
            onChange={handleName}
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
