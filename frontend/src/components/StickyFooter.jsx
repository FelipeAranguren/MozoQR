import React, { useState, useEffect, useMemo } from 'react';
import {
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Box, Snackbar, Alert,
  TextField
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api/tenant';  // 👈 usar el que acabás de corregir
import { postPayment } from '../http';        // si tu pago mock está en ../http, dejalo así
import { api } from '../api';
import QtyStepper from './QtyStepper';


const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

// ---- legacy helpers (por si quedó 1 solo id guardado de versiones anteriores)
const legacyOrderKey = (slug, table) => `LAST_ORDER_${slug}_${table}`;

export default function StickyFooter({ table, tableSessionId }) {
  const { items, subtotal, addItem, removeItem, clearCart } = useCart();
  const { slug } = useParams();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Lista de pedidos NO pagados de esta mesa/sesión: [{ id, total }]
  const [openOrders, setOpenOrders] = useState([]);

  // ===== Cuenta (igual criterio que Mostrador): suma de todos los pedidos no pagados =====
  const accountTotal = useMemo(
    () => openOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
    [openOrders]
  );

  // Si existe un id legacy en localStorage, consideramos que hay cuenta (para no ocultar el botón)
  const legacyHasAccount = useMemo(() => {
    if (!slug || table == null) return false;
    try { return !!localStorage.getItem(legacyOrderKey(slug, table)); } catch { return false; }
  }, [slug, table]);

  const hasAccount = legacyHasAccount || openOrders.length > 0;
  const showOrderBtn = items.length > 0;

  // === Cargar cuenta desde Strapi (misma fuente que Mostrador) ===
  const fetchAccountFromBackend = async () => {
    try {
      if (!slug) return;

      const statusFilter =
        `&filters[order_status][$in][0]=pending` +
        `&filters[order_status][$in][1]=preparing` +
        `&filters[order_status][$in][2]=served`; // todo lo NO pagado

      const qs =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        statusFilter +
        `&publicationState=preview` +
        `&fields[0]=id&fields[1]=total` +
        `&populate[mesa_sesion][fields][0]=id` +
        `&populate[mesa_sesion][populate][mesa][fields][0]=number` +
        `&pagination[pageSize]=100`;

      const res = await api.get(`/pedidos${qs}`);
      const raw = res?.data?.data ?? [];

      const pedidos = raw.map((row) => {
        const a = row.attributes || row;
        const ses = a.mesa_sesion?.data || a.mesa_sesion || null;
        const sesAttrs = ses?.attributes || ses || {};
        const mesa = sesAttrs?.mesa?.data || sesAttrs?.mesa || null;
        const mesaAttrs = mesa?.attributes || mesa || {};
        return {
          id: row.id || a.id,
          total: a.total,
          mesaSesionId: ses?.id ?? null,
          mesaNumber: mesaAttrs?.number ?? null,
        };
      });

      const relevantes = pedidos.filter((p) => {
        if (tableSessionId) return p.mesaSesionId === Number(tableSessionId);
        if (table != null) return String(p.mesaNumber) === String(table);
        return false;
      });

      setOpenOrders(relevantes.map((p) => ({ id: p.id, total: Number(p.total) || 0 })));
    } catch {
      setOpenOrders([]); // no rompas la UI si falla
    }
  };

  // Carga inicial y cada cambio de mesa/sesión; además polling suave
  useEffect(() => { fetchAccountFromBackend(); /* eslint-disable-next-line */ }, [slug, table, tableSessionId]);
  useEffect(() => {
    const id = setInterval(fetchAccountFromBackend, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, table, tableSessionId]);

  // ========== Enviar pedido ==========
  const handleSendOrder = async () => {
  if (!table) {
    setSnack({ open: true, msg: 'Falta el número de mesa (parámetro t).', severity: 'error' });
    return;
  }
  if (!tableSessionId) {
    setSnack({ open: true, msg: 'No se encontró la sesión de mesa activa.', severity: 'error' });
    return;
  }

  try {
    setLoading(true);
    await createOrder(slug, {
      table: Number(table),          // 👈 clave correcta
      tableSessionId,                // 👈 guardamos la sesión en el pedido
      items: items.map(i => ({
        id: i.id,                    // normPrice/normQty lo aceptan
        qty: i.qty,
        precio: i.precio,
        notes: i.notes || '',
      })),
    });

    clearCart();
    await fetchAccountFromBackend(); // refresca los pedidos abiertos
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

  // ========== Pagar cuenta: paga TODOS los pedidos abiertos ==========
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

      for (const o of openOrders) {
        await postPayment(slug, {
          orderId: o.id,
          status: 'approved',
          amount: undefined,  // el backend usa el total del pedido
          provider: 'mock',
          externalRef: null
        });
      }

      // limpiar legacy si existiera
      try { localStorage.removeItem(legacyOrderKey(slug, table)); } catch {}

      await fetchAccountFromBackend(); // debería quedar en 0

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
            onClick={async () => {
              await fetchAccountFromBackend(); // fuerza refresco antes de abrir
              setPayOpen(true);
            }}
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
          {/* Total de la CUENTA (suma de TODOS los pedidos no pagados) */}
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
