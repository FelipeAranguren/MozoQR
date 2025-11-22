// src/pages/Mostrador.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { closeAccount } from '../api/tenant';
import {
  Box, Typography, Card, CardContent, List, ListItem, Button,
  Divider, Grid, TextField, InputAdornment, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Chip, IconButton, Paper, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PaymentsIcon from '@mui/icons-material/Payments';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

export default function Mostrador() {
  const { slug } = useParams();

  // ----- estado principal -----
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState(null);
  const [role, setRole] = useState('all'); // all, kitchen, waiter
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });
  const [loading, setLoading] = useState(true);

  // ----- refs auxiliares -----
  const pedidosRef = useRef([]);
  const seenIdsRef = useRef(new Set());
  const audioCtxRef = useRef(null);

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = audioCtxRef.current || new AudioContext();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.16);
    } catch { }
  };

  // =================== carga de pedidos ===================
  const fetchPedidos = async () => {
    try {
      const listQS =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        `&filters[order_status][$ne]=cancelled` + // Exclude cancelled for now or show in separate column
        `&publicationState=preview` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&populate[items][populate][product]=true` +
        `&sort[0]=createdAt:desc` +
        `&pagination[pageSize]=100`;

      const res = await api.get(`/pedidos${listQS}`);
      const raw = res?.data?.data ?? [];

      const mapped = raw.map(p => {
        const a = p.attributes || p;
        return {
          id: p.id,
          documentId: a.documentId,
          order_status: a.order_status,
          customerNotes: a.customerNotes,
          total: a.total,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          items: (a.items?.data || a.items || []).map(it => {
            const itAttr = it.attributes || it;
            const prod = itAttr.product?.data?.attributes || itAttr.product || {};
            return {
              id: it.id,
              quantity: itAttr.quantity,
              name: prod.name || 'Producto',
              notes: itAttr.notes
            };
          }),
          mesa: a.mesa_sesion?.data?.attributes?.mesa?.data?.attributes?.number ||
            a.mesa_sesion?.mesa?.number || '?',
          payment_method: a.payment_method,
          payment_status: a.payment_status
        };
      });

      // Detect new orders
      const newOrders = mapped.filter(p => !seenIdsRef.current.has(p.id) && p.order_status === 'pending');
      if (newOrders.length > 0) {
        playBeep();
        setSnack({ open: true, msg: `${newOrders.length} pedido(s) nuevo(s)`, severity: 'info' });
      }
      mapped.forEach(p => seenIdsRef.current.add(p.id));

      setPedidos(mapped);
      pedidosRef.current = mapped;
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 5000);
    return () => clearInterval(interval);
  }, [slug]);

  // Actions
  const updateStatus = async (id, status) => {
    try {
      await api.put(`/pedidos/${id}`, { data: { order_status: status } });
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, order_status: status } : p));
      setSnack({ open: true, msg: `Pedido actualizado a ${status}`, severity: 'success' });
    } catch (err) {
      console.error('Error updating status:', err);
      setSnack({ open: true, msg: 'Error al actualizar', severity: 'error' });
    }
  };

  // Kanban Columns
  const columns = useMemo(() => {
    const cols = {
      pending: { title: 'Nuevos', color: '#ff9800', icon: <AccessTimeIcon />, items: [] },
      preparing: { title: 'En Cocina', color: '#2196f3', icon: <RestaurantIcon />, items: [] },
      served: { title: 'Listos / Servidos', color: '#4caf50', icon: <CheckCircleIcon />, items: [] },
      paid: { title: 'Pagados / Cerrados', color: '#9e9e9e', icon: <PaymentsIcon />, items: [] },
    };

    pedidos.forEach(p => {
      if (cols[p.order_status]) {
        cols[p.order_status].items.push(p);
      } else if (p.order_status === 'paid') { // Map paid to paid column if status is paid
        cols.paid.items.push(p);
      }
    });

    return cols;
  }, [pedidos]);

  // Role Filtering
  const visibleColumns = useMemo(() => {
    if (role === 'kitchen') return ['pending', 'preparing'];
    if (role === 'waiter') return ['pending', 'preparing', 'served', 'paid'];
    return ['pending', 'preparing', 'served', 'paid'];
  }, [role]);

  return (
    <Box sx={{ p: 2, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">
          Tablero de Pedidos — {slug}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ToggleButtonGroup
            value={role}
            exclusive
            onChange={(e, newRole) => newRole && setRole(newRole)}
            size="small"
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton value="kitchen">Cocina</ToggleButton>
            <ToggleButton value="waiter">Mozo/Caja</ToggleButton>
          </ToggleButtonGroup>
          <Button startIcon={<RefreshIcon />} onClick={fetchPedidos} variant="outlined">
            Actualizar
          </Button>
        </Box>
      </Box>

      {/* Kanban Board */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', flexGrow: 1, pb: 2 }}>
        {visibleColumns.map(colKey => {
          const col = columns[colKey];
          return (
            <Paper
              key={colKey}
              sx={{
                minWidth: 300,
                width: 320,
                bgcolor: '#ebecf0',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '100%'
              }}
            >
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                {col.icon}
                <Typography variant="subtitle1" fontWeight="bold">
                  {col.title} ({col.items.length})
                </Typography>
              </Box>

              <Box sx={{ p: 1, overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {col.items.map(order => (
                  <Card key={order.id} sx={{ boxShadow: 1 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Chip label={`Mesa ${order.mesa}`} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>

                      <List dense disablePadding>
                        {order.items.map((it, idx) => (
                          <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                            <Typography variant="body2">
                              <b>{it.quantity}x</b> {it.name}
                              {it.notes && <span style={{ display: 'block', color: 'gray', fontSize: '0.85em' }}>({it.notes})</span>}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>

                      {order.customerNotes && (
                        <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                          Nota: {order.customerNotes}
                        </Alert>
                      )}

                      <Divider sx={{ my: 1 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" fontWeight="bold">
                          {money(order.total)}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {colKey === 'pending' && (
                            <Button size="small" variant="contained" color="primary" onClick={() => updateStatus(order.id, 'preparing')}>
                              Cocinar
                            </Button>
                          )}
                          {colKey === 'preparing' && (
                            <Button size="small" variant="contained" color="success" onClick={() => updateStatus(order.id, 'served')}>
                              Listo
                            </Button>
                          )}
                          {colKey === 'served' && (
                            <Button size="small" variant="outlined" onClick={() => updateStatus(order.id, 'paid')}>
                              Pagado
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}