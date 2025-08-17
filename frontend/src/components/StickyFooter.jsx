// src/components/StickyFooter.jsx
import React, { useState } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api/tenant';
import QtyStepper from './QtyStepper';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

export default function StickyFooter({ table, tableSessionId }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const showFooter = items.length > 0;

  const handleSendOrder = async () => {
    if (!table) {
      setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
      return;
    }
    try {
      setLoading(true);
      await createOrder(slug, {
        table,
        tableSessionId,
        items: items.map(i => ({
          productId: i.id,
          qty: i.qty,
          notes: i.notes || ''
        }))
      });
      clearCart();
      setSnack({ open: true, msg: 'Pedido enviado con éxito ✅', severity: 'success' });
      setOpen(false);
    } catch (err) {
      console.error(err);
      const apiMsg =
        err?.response?.data?.error?.message || // Strapi v4/v5 error
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

  return (
    <>
      {showFooter && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 1300,
          }}
        >
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
        </Paper>
      )}

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
          <Box sx={{ mt: 1, textAlign: 'right' }}>
            <Typography variant="subtitle1">
              Total: <strong>{money(subtotal)}</strong>
            </Typography>
          </Box>
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
    </>
  );
}