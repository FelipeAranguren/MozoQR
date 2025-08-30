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
  Grid,
} from '@mui/material';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

export default function Mostrador() {
  const { slug } = useParams();

  const [pedidos, setPedidos] = useState([]);     // pedidos visibles (activos o historial)
  const [cuentas, setCuentas] = useState([]);     // agrupadas por mesa_sesion
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // ref para snapshot siempre fresco
  const pedidosRef = useRef([]);
  const servingIdsRef = useRef(new Set());

  // ids (documentId) que deben “flashear” por ~1.2s
  const [flashIds, setFlashIds] = useState(new Set());
  const triggerFlash = (documentId) => {
    setFlashIds((prev) => {
      const next = new Set(prev);
      next.add(documentId);
      return next;
    });
    setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }, 1200);
  };

  // helpers
  const keyOf = (p) => p?.documentId || String(p?.id);
  const isActive = (st) => !['served', 'paid'].includes(st);

  const ordenar = (arr) => {
    const orden = { pending: 0, preparing: 1 };
    return [...arr].sort((a, b) => {
      const pa = orden[a.order_status] ?? 2;
      const pb = orden[b.order_status] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  };

  // --------- mapeos/rehidratación ----------
  const mapPedidoRow = (row) => {
    const a = row.attributes || row;

    // mesa_sesion (relation)
    const ses = a.mesa_sesion?.data || a.mesa_sesion || null;
    const sesAttrs = ses?.attributes || ses || {};
    const mesa = sesAttrs?.mesa?.data || sesAttrs?.mesa || null;
    const mesaAttrs = mesa?.attributes || mesa || {};

    return {
      id: row.id || a.id,
      documentId: a.documentId,
      order_status: a.order_status,
      customerNotes: a.customerNotes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      total: a.total,
      mesa_sesion: ses
        ? {
            id: ses.id,
            session_status: sesAttrs.session_status,
            code: sesAttrs.code,
            mesa: mesa ? { id: mesa.id, number: mesaAttrs.number } : null,
          }
        : null,
    };
  };

  // Si un pedido viene sin mesa_sesion, intento una rehidratación puntual con populate profundo.
  const hydrateMesaSesionIfMissing = async (pedido) => {
    if (pedido.mesa_sesion) return pedido;
    try {
      const qs =
        `?publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=customerNotes&fields[4]=total&fields[5]=createdAt&fields[6]=updatedAt` +
        `&populate[mesa_sesion][fields][0]=session_status` +
        `&populate[mesa_sesion][fields][1]=code` +
        `&populate[mesa_sesion][populate][mesa][fields][0]=number`;

      const r = await api.get(`/pedidos/${pedido.id}${qs}`);
      const data = r?.data?.data;
      if (!data) return pedido;

      // en /:id, Strapi devuelve data: { id, attributes, ... }
      const filled = mapPedidoRow({
        id: data.id,
        ...(data.attributes ? data : { attributes: data }),
      });

      return filled.mesa_sesion ? filled : pedido;
    } catch {
      return pedido;
    }
  };

  // ---- items de un pedido (por id numérico) ----
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
        product: { id: prodData.id, name: prodAttrs.name },
      };
    });
  };

  // ---- lista de pedidos (aplanado v4 + mesa_sesion/mesa) ----
  const fetchPedidos = async () => {
    try {
      const sort = showHistory ? 'updatedAt:desc' : 'createdAt:asc';
      const statusFilter = showHistory
        ? `&filters[order_status][$in][0]=served&filters[order_status][$in][1]=paid`
        : `&filters[order_status][$in][0]=pending&filters[order_status][$in][1]=preparing`;

      // Traemos sólo lo necesario, y populamos la relación para obtener el número de mesa
      const listQS =
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        statusFilter +
        `&publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=customerNotes&fields[4]=total&fields[5]=createdAt&fields[6]=updatedAt` +
        `&populate[mesa_sesion][fields][0]=session_status` +
        `&populate[mesa_sesion][fields][1]=code` +
        `&populate[mesa_sesion][populate][mesa][fields][0]=number` +
        `&sort[0]=${encodeURIComponent(sort)}` +
        `&pagination[pageSize]=100`;

      const res = await api.get(`/pedidos${listQS}`);
      const base = res?.data?.data ?? [];

      // Aplanar
      const planos = base.map(mapPedidoRow);

      // Re-hidratar puntualmente los que (por timing) vinieron sin mesa_sesion
      const planosFilled = await Promise.all(
        planos.map((p) => hydrateMesaSesionIfMissing(p))
      );

      // quitar ids que ya no aparecen desde el servidor
      servingIdsRef.current.forEach((id) => {
        const found = planosFilled.find((p) => p.id === id);
        if (!found || !isActive(found.order_status)) {
          servingIdsRef.current.delete(id);
        }
      });

      // snapshot previo por key (para no perder items si una consulta viene sin populate)
      const prevByKey = new Map(pedidosRef.current.map((p) => [keyOf(p), p]));

      // Si el pedido está activo, traemos ítems; sino los omitimos
      const conItems = await Promise.all(
        planosFilled.map(async (p) => {
          let items = [];
          if (isActive(p.order_status)) {
            try { items = await fetchItemsDePedido(p.id); } catch {}
          }
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
        ? ordenados.filter((p) => ['served', 'paid'].includes(p.order_status))
        : ordenados.filter(
            (p) => isActive(p.order_status) && !servingIdsRef.current.has(p.id)
          );

      pedidosRef.current = visibles;
      setPedidos(visibles);

      // ---- agrupar pedidos en cuentas (por sesión de mesa) ----
      const grupos = new Map();
      ordenados.forEach((p) => {
        const sesId = p.mesa_sesion?.id;
        const mesaNum = p.mesa_sesion?.mesa?.number;
        const key = sesId ? `ses:${sesId}` : `mesa:${mesaNum ?? 's/n'}`;
        const arr = grupos.get(key) || [];
        arr.push(p);
        grupos.set(key, arr);
      });

      const cuentasArr = Array.from(grupos, ([groupKey, arr]) => {
        const hasUnpaid = arr.some((o) => o.order_status !== 'paid');
        const lista = hasUnpaid ? arr.filter((o) => o.order_status !== 'paid') : arr;
        const total = lista.reduce((sum, it) => sum + Number(it.total || 0), 0);
        const lastUpdated = arr.reduce(
          (max, it) => Math.max(max, new Date(it.updatedAt).getTime()),
          0
        );

        // Mostrar número de mesa si existe en alguno
        const mesaNumber =
          arr.find((x) => Number.isFinite(Number(x.mesa_sesion?.mesa?.number)))?.mesa_sesion?.mesa?.number ?? null;
        const sesId = arr.find((x) => x.mesa_sesion?.id)?.mesa_sesion.id ?? null;

        return {
          groupKey,
          mesaNumber,
          mesaSesionId: sesId,
          pedidos: ordenar(lista),
          total,
          hasUnpaid,
          lastUpdated,
        };
      });

      const filtradas = showHistory
        ? cuentasArr.filter((c) => !c.hasUnpaid).sort((a, b) => b.lastUpdated - a.lastUpdated)
        : cuentasArr.filter((c) => c.hasUnpaid).sort((a, b) => {
            const am = Number.isFinite(Number(a.mesaNumber)) ? Number(a.mesaNumber) : 999999;
            const bm = Number.isFinite(Number(b.mesaNumber)) ? Number(b.mesaNumber) : 999999;
            return am - bm;
          });

      setCuentas(filtradas);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, showHistory]);

  // ---- actualizar estado por ID numérico (más robusto que documentId) ----
  const putEstado = async (id, estado) => {
    await api.put(`/pedidos/${id}`, { data: { order_status: estado } });
  };

  const refreshItemsDe = async (orderId) => {
    try {
      const items = await fetchItemsDePedido(orderId);
      if (items?.length) {
        setPedidos((prev) => {
          const next = prev.map((p) => (p.id === orderId ? { ...p, items } : p));
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
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'preparing' } : p
        );
        pedidosRef.current = next;
        return next;
      });

      triggerFlash(pedido.documentId);
      await putEstado(pedido.id, 'preparing');
      await refreshItemsDe(pedido.id);
    } catch (err) {
      console.error('Error al marcar como Recibido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'pending' } : p
        );
        pedidosRef.current = next;
        return next;
      });
    }
  };

  const marcarComoServido = async (pedido) => {
    try {
      triggerFlash(pedido.documentId);
      servingIdsRef.current.add(pedido.id);

      setPedidos((prev) => {
        const next = prev.filter((p) => keyOf(p) !== keyOf(pedido));
        pedidosRef.current = next;
        return next;
      });

      await putEstado(pedido.id, 'served');
      await fetchPedidos();
    } catch (err) {
      console.error('Error al marcar como servido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      servingIdsRef.current.delete(pedido.id);
      setPedidos((prev) => {
        if (prev.some((p) => keyOf(p) === keyOf(pedido))) return prev;
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
        <Button variant="outlined" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? 'Ver activos' : 'Ver historial'}
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      <Grid container spacing={2}>
        {/* Columna de pedidos */}
        <Grid item xs={12} md={8}>
          {!error && pedidos.length === 0 && (
            <Typography>
              {showHistory ? 'No hay pedidos cerrados.' : 'No hay pedidos activos.'}
            </Typography>
          )}

          <Grid container spacing={2}>
            {pedidos.map((pedido) => {
              const {
                id,
                documentId,
                order_status,
                customerNotes,
                items = [],
                total,
              } = pedido;
              const mesaNumero = pedido.mesa_sesion?.mesa?.number;
              const flashing = flashIds.has(documentId);
              const tituloMesa = `Mesa ${mesaNumero ?? 's/n'}`;

              return (
                <Grid item key={documentId || id} xs={12} sm={6} md={6} lg={4}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: flashing ? 'warning.light' : 'background.paper',
                      transition: 'background-color 600ms ease',
                      boxShadow: flashing ? 6 : 2,
                      border: flashing ? '2px solid rgba(255,193,7,0.6)' : '1px solid',
                      borderColor: flashing ? 'warning.main' : 'divider',
                    }}
                  >
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6">{tituloMesa}</Typography>

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
                        {items.map((item) => {
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

        {/* Columna de cuentas */}
        <Grid item xs={12} md={4}>
          <Typography variant="h5" gutterBottom>
            {showHistory ? 'Cuentas pagadas' : 'Cuentas'}
          </Typography>

          {cuentas.map((c) => (
            <Card key={c.groupKey} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6">Mesa {c.mesaNumber ?? 's/n'}</Typography>
                <List>
                  {c.pedidos.map((p) => (
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
