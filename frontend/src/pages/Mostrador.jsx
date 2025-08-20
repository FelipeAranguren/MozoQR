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

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

export default function Mostrador() {
  const { slug } = useParams();
  const [pedidos, setPedidos] = useState([]); // pedidos activos (sin servir)
  const [cuentas, setCuentas] = useState([]); // agrupado por mesa
  const pedidosRef = useRef([]);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

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

  // Traer ítems por ID de pedido y aplanar la respuesta de Strapi
  const fetchItemsDePedido = async (orderId) => {
    const qs =
      `/item-pedidos?publicationState=preview` +
      `&filters[order][id][$eq]=${orderId}` +
      `&populate[product]=true` +
      `&fields[0]=id&fields[1]=quantity&fields[2]=notes&fields[3]=UnitPrice&fields[4]=totalPrice` +
      `&pagination[pageSize]=100`;
    const r = await api.get(qs);
    const raw = r?.data?.data ?? [];
    return raw.map((it) => {
      const a = it.attributes || it;
      const prodData = a.product?.data || a.product || {};
      const prodAttrs = prodData.attributes || prodData;
      return {
        id: it.id || a.id,
        quantity: a.quantity,
        notes: a.notes,
        UnitPrice: a.UnitPrice,
        totalPrice: a.totalPrice,
        product: {
          id: prodData.id,
          name: prodAttrs.name,
        },
      };
    });
  };

  // Lista + items, sin perder items locales si la consulta llega vacía
  const fetchPedidos = async () => {
    try {
      const sort = showHistory ? 'updatedAt:desc' : 'createdAt:asc';
      const listQS =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        `&fields=id,documentId,table,order_status,customerNotes,createdAt,updatedAt,total` +
        `&sort=${sort}` +
        (showHistory
          ?
            `&filters[order_status][$in][0]=served&filters[order_status][$in][1]=paid`
          : `&filters[order_status][$ne]=paid`);
      const res = await api.get(`/pedidos${listQS}`);
      const basicos = res?.data?.data ?? [];

      // Usar siempre el snapshot fresco desde el ref
      const prevByKey = new Map(pedidosRef.current.map(p => [keyOf(p), p]));

      const conItems = await Promise.all(
        basicos.map(async (p) => {
          let items = [];
          try {
            items = await fetchItemsDePedido(p.id);
          } catch {}
          if (!items.length) {
            const prev = prevByKey.get(keyOf(p));
            items = prev?.items ?? [];
          }
          return { ...p, items };
        })
      );

      const ordenados = showHistory
        ? [...conItems].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        : ordenar(conItems);

      const visibles = showHistory
        ? ordenados.filter(p => ['served', 'paid'].includes(p.order_status))
        : ordenados.filter(p => !['served', 'paid'].includes(p.order_status));
      pedidosRef.current = visibles;
      setPedidos(visibles);

      // Agrupar por mesa para generar las cuentas
      const porMesa = new Map();
      const fuenteCuentas = showHistory
        ? ordenados.filter(p => p.order_status === 'paid')
        : ordenados.filter(p => p.order_status !== 'paid');
      fuenteCuentas.forEach(p => {
        const mesa = p.table;
        const arr = porMesa.get(mesa) || [];
        arr.push(p);
        porMesa.set(mesa, arr);
      });
      const cuentasArr = Array.from(porMesa, ([mesa, arr]) => ({
        table: mesa,
        pedidos: ordenar(arr),
        total: arr.reduce((sum, it) => sum + Number(it.total || 0), 0),
      })).sort((a, b) => a.table - b.table);
      setCuentas(cuentasArr);

      setError(null);
    } catch (err) {
      console.error('Error al obtener pedidos:', err?.response?.data || err);
      setError('No se pudieron cargar los pedidos.');
    }
  };

  useEffect(() => {
    pedidosRef.current = [];
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 3000);
    return () => clearInterval(interval);
  }, [slug, showHistory]);

  const putEstadoByDocumentId = async (documentId, estado) => {
    await api.put(`/pedidos/${documentId}`, { data: { order_status: estado } });
  };

  const refreshItemsDe = async (orderId) => {
    try {
      const items = await fetchItemsDePedido(orderId);
      if (items?.length) {
        setPedidos(prev => {
          const next = prev.map(p => (p.id === orderId ? { ...p, items } : p));
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
      await refreshItemsDe(pedido.id);
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ flexGrow: 1 }}>
          Mostrador - {slug?.toUpperCase?.()} {showHistory ? '(Historial)' : ''}
        </Typography>
        <Button variant="outlined" onClick={() => setShowHistory(s => !s)}>
          {showHistory ? 'Ver activos' : 'Ver historial'}
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {!error && pedidos.length === 0 && (
            <Typography>
              {showHistory ? 'No hay pedidos cerrados.' : 'No hay pedidos activos.'}
            </Typography>
          )}

          <Grid container spacing={2}>
            {pedidos.map((pedido) => {
              const { id, documentId, table, order_status, customerNotes, items = [], total } = pedido;

              // ¿Debe “flashear” este pedido?
              const flashing = flashIds.has(documentId);

              return (
                <Grid item key={documentId || id} xs={12} sm={6} md={6} lg={4}>
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

                      <Typography variant="subtitle1" sx={{ textAlign: 'right', mb: 1 }}>
                        Total: {money(total)}
                      </Typography>

                      {!showHistory && (
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
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        <Grid item xs={12} md={4}>
          <Typography variant="h5" gutterBottom>
            {showHistory ? 'Cuentas pagadas' : 'Cuentas'}
          </Typography>
          {cuentas.map(c => (
            <Card key={c.table} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6">Mesa {c.table}</Typography>
                <List>
                  {c.pedidos.map(p => (
                    <ListItem key={p.documentId || p.id}>
                      Pedido {p.id} - {money(p.total)}
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" sx={{ textAlign: 'right' }}>
                  Total: {money(c.total)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
    </Box>
  );
}
