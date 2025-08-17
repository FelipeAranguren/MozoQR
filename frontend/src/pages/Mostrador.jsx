// src/pages/Mostrador.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  Button,
  Divider,
  Grid
} from '@mui/material';

export default function Mostrador() {
  const { slug } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const pedidosRef = useRef([]);
  const [error, setError] = useState(null);

  // IDs (documentId) que deben “flashear” visualmente por ~1.2s
  const [flashIds, setFlashIds] = useState(new Set());

  // --- util: dispara un flash visual en un pedido por documentId ---
  const triggerFlash = (documentId) => {
    setFlashIds(prev => {
      const next = new Set(prev);
      next.add(documentId);
      return next;
    });
    setTimeout(() => {
      setFlashIds(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }, 1200); // duración del flash
  };

  // Silencio HMR en dev (opcional)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const origError = console.error;
    console.error = (...args) => {
      try {
        const msg = args?.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
        if (msg.includes('WebSocket connection to') || msg.includes("Failed to construct 'WebSocket'")) return;
      } catch {}
      origError(...args);
    };
    return () => { console.error = origError; };
  }, []);

  // --- helpers ---
  const keyOf = (p) => p?.documentId || String(p?.id); // CLAVE ESTABLE

  const ordenar = (arr) => {
    const orden = { pending: 0, preparing: 1 };
    return [...arr].sort((a, b) => {
      const pa = orden[a.order_status] ?? 2;
      const pb = orden[b.order_status] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  };

  const listBaseQS =
    `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
    `&filters[order_status][$ne]=served` +
    `&fields=id,documentId,table,order_status,customerNotes,createdAt` +
    `&sort=createdAt:asc`;

  // Traer ítems por documentId (más robusto)
  const fetchItemsDePedido = async (orderDocumentId) => {
    const qs =
      `/item-pedidos?filters[order][documentId][$eq]=${encodeURIComponent(orderDocumentId)}` +
      `&populate[product]=true` +
      `&fields=id,quantity,notes,UnitPrice,totalPrice`;
    const r = await api.get(qs);
    return r?.data?.data ?? [];
  };

  // Lista + items, sin perder items locales si la consulta llega vacía
  const fetchPedidos = async () => {
    try {
      const res = await api.get(`/pedidos${listBaseQS}`);
      const basicos = res?.data?.data ?? [];

      // Usar siempre el snapshot fresco desde el ref
      const prevByKey = new Map(pedidosRef.current.map(p => [keyOf(p), p]));

      const conItems = await Promise.all(
        basicos.map(async (p) => {
          let items = [];
          try {
            items = await fetchItemsDePedido(p.documentId);
          } catch {}
          if (!items.length) {
            const prev = prevByKey.get(keyOf(p));
            items = prev?.items ?? [];
          }
          return { ...p, items };
        })
      );

      const ordenados = ordenar(conItems);
      pedidosRef.current = ordenados;
      setPedidos(ordenados);
      setError(null);
    } catch (err) {
      console.error('Error al obtener pedidos:', err?.response?.data || err);
      setError('No se pudieron cargar los pedidos.');
    }
  };

  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 3000);
    return () => clearInterval(interval);
  }, [slug]);

  const putEstadoByDocumentId = async (documentId, estado) => {
    await api.put(`/pedidos/${documentId}`, { data: { order_status: estado } });
  };

  const refreshItemsDe = async (orderDocumentId) => {
    try {
      const items = await fetchItemsDePedido(orderDocumentId);
      if (items?.length) {
        setPedidos(prev => {
          const next = prev.map(p => (p.documentId === orderDocumentId ? { ...p, items } : p));
          pedidosRef.current = next;
          return next;
        });
      }
    } catch (e) {
      console.warn('No se pudieron refrescar items del pedido:', e?.response?.data || e);
    }
  };

  const marcarComoRecibido = async (pedido) => {
    try {
      // Optimista: NO tocamos items, solo estado
      setPedidos(prev => {
        const next = prev.map(p =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'preparing' } : p
        );
        pedidosRef.current = next;
        return next;
      });

      // Efecto visual inmediato
      triggerFlash(pedido.documentId);

      // Backend
      await putEstadoByDocumentId(pedido.documentId, 'preparing');

      // Rehidratar items por las dudas
      await refreshItemsDe(pedido.documentId);
    } catch (err) {
      console.error('Error al marcar como Recibido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      // rollback
      setPedidos(prev => {
        const next = prev.map(p =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'pending' } : p
        );
        pedidosRef.current = next;
        return next;
      });
    }
  };

  const marcarComoServido = async (pedido) => {
    try {
      // Efecto visual antes de quitarlo (opcional, flash corto)
      triggerFlash(pedido.documentId);

      // Optimista: quitarlo
      setPedidos(prev => {
        const next = prev.filter(p => keyOf(p) !== keyOf(pedido));
        pedidosRef.current = next;
        return next;
      });

      await putEstadoByDocumentId(pedido.documentId, 'served');

      // refresco general por si aparecieron nuevos
      fetchPedidos();
    } catch (err) {
      console.error('Error al marcar como servido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      // rollback
      setPedidos(prev => {
        if (prev.some(p => keyOf(p) === keyOf(pedido))) return prev;
        const next = [pedido, ...prev];
        pedidosRef.current = next;
        return next;
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Mostrador - {slug?.toUpperCase?.()}
      </Typography>

      {error && <Typography color="error">{error}</Typography>}
      {!error && pedidos.length === 0 && (
        <Typography>No hay pedidos activos.</Typography>
      )}

      <Grid container spacing={2}>
        {pedidos.map((pedido) => {
          const { id, documentId, table, order_status, customerNotes, items = [] } = pedido;

          // ¿Debe “flashear” este pedido?
          const flashing = flashIds.has(documentId);

          return (
            <Grid item key={documentId || id} xs={12} sm={6} md={4} lg={3}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  // efecto visual
                  bgcolor: flashing ? 'warning.light' : 'background.paper',
                  transition: 'background-color 600ms ease',
                  boxShadow: flashing ? 6 : 2,
                  border: flashing ? '2px solid rgba(255,193,7,0.6)' : '1px solid',
                  borderColor: flashing ? 'warning.main' : 'divider',
                }}
              >
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6">Mesa {table}</Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color:
                        order_status === 'pending'
                          ? 'error.main'
                          : order_status === 'preparing'
                          ? 'warning.main'
                          : 'text.secondary',
                      fontWeight: 600,
                    }}
                  >
                    Estado: {order_status || 'No definido'}
                  </Typography>

                  {customerNotes && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Notas:</strong> {customerNotes}
                    </Typography>
                  )}

                  <Divider sx={{ my: 1 }} />

                  <List sx={{ flexGrow: 1 }}>
                    {items.map(item => {
                      const prod = item?.product;
                      return (
                        <ListItem key={item.id}>
                          {prod?.name ? `${prod.name} x${item.quantity}` : 'Producto sin datos'}
                        </ListItem>
                      );
                    })}
                  </List>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {order_status !== 'preparing' && (
                      <Button
                        variant="outlined"
                        color="info"
                        onClick={() => marcarComoRecibido(pedido)}
                        fullWidth
                      >
                        Recibido
                      </Button>
                    )}
                    {order_status !== 'served' && (
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => marcarComoServido(pedido)}
                        fullWidth
                      >
                        Completado
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
