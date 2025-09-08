// src/components/StickyFooter.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder, closeAccount, hasOpenAccount } from '../api/tenant';
import QtyStepper from './QtyStepper';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

export default function StickyFooter({ table, tableSessionId }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [hasAccount, setHasAccount] = useState(false);

  const showOrderBtn = items.length > 0;

  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
      return;
    }
    try {
      setLoading(true);
      await createOrder(slug, {
        table,
        items: items.map(i => ({
          productId: i.id,
          qty: i.qty,
          price: i.precio,
          notes: i.notes || ''
        }))
      });
      clearCart();
      setSnack({ open: true, msg: 'Pedido enviado con éxito ✅', severity: 'success' });
      setOpen(false);
      setHasAccount(true);
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
      await closeAccount(slug, { table, tableSessionId });
      setSnack({ open: true, msg: 'Cuenta pagada con éxito ✅', severity: 'success' });
      setPayOpen(false);
      setHasAccount(false);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!table) {
        setHasAccount(false);
        return;
      }
      try {
        const exists = await hasOpenAccount(slug, { table, tableSessionId });
        if (!cancelled) setHasAccount(exists);
      } catch (e) {
        if (!cancelled) setHasAccount(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, table, tableSessionId]);

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

      <Dialog
        open={payOpen}
        onClose={() => !payLoading && setPayOpen(false)}
        fullWidth
        aria-labelledby="pay-account-title"
      >
        <DialogTitle id="pay-account-title">Pagar cuenta</DialogTitle>
        <DialogContent dividers>
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