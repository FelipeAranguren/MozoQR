// src/pages/Mostrador.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import {
  Box, Typography, Card, CardContent, List, ListItem, Button,
  Divider, Grid, TextField, InputAdornment, Snackbar, Alert
} from '@mui/material';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

export default function Mostrador() {
  const { slug } = useParams();

  // ----- estado principal -----
  const [pedidos, setPedidos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashIds, setFlashIds] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });

  // ----- refs auxiliares (SOLO AQUÍ ARRIBA; no dentro de funciones) -----
  const pedidosRef = useRef([]);
  const servingIdsRef = useRef(new Set());
  const hasLoadedRef = useRef(false);          // para no avisar en 1ª carga
  const seenIdsRef = useRef(new Set());
  const pendingBeforeHistoryRef = useRef(new Set());
  const cachedViewsRef = useRef({
    active: { pedidos: [], cuentas: [] },
    history: { pedidos: [], cuentas: [] },
  });
  const audioCtxRef = useRef(null);            // beep

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
    } catch {}
  };

  const triggerFlash = (documentId) => {
    if (!documentId) return;
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

  const updateCachedView = (nextPedidos, nextCuentas = null) => {
    const modeKey = showHistory ? 'history' : 'active';
    const cuentasForCache =
      nextCuentas ?? cachedViewsRef.current[modeKey]?.cuentas ?? cuentas;
    cachedViewsRef.current[modeKey] = {
      pedidos: nextPedidos,
      cuentas: cuentasForCache,
    };
  };

  // ---- helpers
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

  const ordenarActivos = (arr) => {
    return [...arr].sort((a, b) => {
      const wa = a.order_status === 'preparing' ? 1 : 0;
      const wb = b.order_status === 'preparing' ? 1 : 0;
      if (wa !== wb) return wa - wb;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const mapPedidoRow = (row) => {
    const a = row.attributes || row;
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
      const filled = mapPedidoRow({ id: data.id, ...(data.attributes ? data : { attributes: data }) });
      return filled.mesa_sesion ? filled : pedido;
    } catch {
      return pedido;
    }
  };

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

  // =================== búsqueda por mesa (parcial) ===================
  const mesaTokens = useMemo(() => {
    const tokens = (searchQuery.match(/\d+/g) || []).map((s) => s.trim()).filter(Boolean);
    return tokens;
  }, [searchQuery]);

  const pedidoMatchesMesaPartial = (p) => {
    if (mesaTokens.length === 0) return true;
    const mesaNum = p?.mesa_sesion?.mesa?.number;
    if (mesaNum == null) return false;
    const mesaStr = String(mesaNum);
    return mesaTokens.some((t) => mesaStr.includes(t));
  };

  const cuentaMatchesMesaPartial = (c) => {
    if (mesaTokens.length === 0) return true;
    const mesaNum = c?.mesaNumber;
    if (mesaNum == null) return false;
    const mesaStr = String(mesaNum);
    return mesaTokens.some((t) => mesaStr.includes(t));
  };

  // =================== carga de pedidos ===================
  const fetchPedidos = async () => {
    try {
      const sort = showHistory ? 'updatedAt:desc' : 'createdAt:asc';
      const statusFilter = showHistory
        ? `&filters[order_status][$in][0]=served&filters[order_status][$in][1]=paid`
        : `&filters[order_status][$in][0]=pending&filters[order_status][$in][1]=preparing&filters[order_status][$in][2]=served`;

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

      const planos = base.map(mapPedidoRow);
      const planosFilled = await Promise.all(planos.map(hydrateMesaSesionIfMissing));

      // cargar items (siempre en activos; en historial sólo si faltan)
      const prevByKey = new Map(pedidosRef.current.map((p) => [keyOf(p), p]));
      const conItems = await Promise.all(
        planosFilled.map(async (p) => {
          const prev = prevByKey.get(keyOf(p));
          const prevItems = prev?.items ?? [];
          let items = prevItems;

          const shouldFetchItems =
            isActive(p.order_status) ||
            (showHistory && ['served', 'paid'].includes(p.order_status) && prevItems.length === 0);

          if (shouldFetchItems) {
            try {
              const fetched = await fetchItemsDePedido(p.id);
              if (fetched?.length) {
                items = fetched;
              }
            } catch {}
          }
          return { ...p, items };
        })
      );

      const ordenados = showHistory
        ? [...conItems].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        : ordenarActivos(conItems);

      // visibles según modo
      const visibles = showHistory
        ? ordenados.filter((p) => ['served', 'paid'].includes(p.order_status))
        : ordenados.filter((p) => isActive(p.order_status) && !servingIdsRef.current.has(p.id));

        if (!showHistory && pendingBeforeHistoryRef.current.size > 0) {
        pendingBeforeHistoryRef.current.forEach((id) => seenIdsRef.current.add(id));
        pendingBeforeHistoryRef.current = new Set();
      }

      // ---- avisos SOLO por pedidos nuevos (ID no visto) y que pasan el filtro de mesa
      const nuevosVisibles = visibles.filter(
        (p) => !seenIdsRef.current.has(p.id) && p.order_status === 'pending'
      );
   
      const nuevosFiltrados = nuevosVisibles.filter(pedidoMatchesMesaPartial);
      if (!showHistory && hasLoadedRef.current && nuevosFiltrados.length > 0) {
        try { playBeep(); } catch {}
        setSnack({ open: true, msg: `${nuevosFiltrados.length} pedido(s) nuevo(s)`, severity: 'info' });
        nuevosFiltrados.forEach((n) => triggerFlash(n.documentId));
      }
      // sembrar vistos (en 1ª carga: todos, luego: sólo los nuevos)
      const idsAAgregar = hasLoadedRef.current ? nuevosVisibles : visibles;
      idsAAgregar.forEach((p) => seenIdsRef.current.add(p.id));

      // guardar visibles
      pedidosRef.current = visibles;
      setPedidos(visibles);

      // ---- agrupar cuentas (tu lógica original)
      const grupos = new Map();
      ordenados.forEach((p) => {
        const mesaNum = p.mesa_sesion?.mesa?.number;
        const key = showHistory
          ? p.mesa_sesion?.id != null
            ? `sesion:${p.mesa_sesion.id}`
            : mesaNum != null ? `mesa:${mesaNum}` : `pedido:${p.id}`
          : mesaNum != null
            ? `mesa:${mesaNum}`
            : p.mesa_sesion?.id != null
              ? `sesion:${p.mesa_sesion.id}`
              : `pedido:${p.id}`;
        const arr = grupos.get(key) || [];
        arr.push(p);
        grupos.set(key, arr);
      });

      if (showHistory) {
        for (const [key, arr] of Array.from(grupos.entries())) {
          if (!key.startsWith('mesa:')) continue;
          const mesaNum = key.slice(5);
          let targetKey = null; let latest = 0;
          for (const [k, otros] of grupos.entries()) {
            if (!k.startsWith('sesion:')) continue;
            const coincide = otros.some((o) => o.mesa_sesion?.mesa?.number == mesaNum);
            if (!coincide) continue;
            const last = otros.reduce((max, it) => Math.max(max, new Date(it.updatedAt).getTime()), 0);
            if (last >= latest) { latest = last; targetKey = k; }
          }
          if (targetKey) {
            grupos.get(targetKey).push(...arr);
            grupos.delete(key);
          }
        }
        const porMesa = new Map();
        for (const [key, arr] of grupos.entries()) {
          const mesa = arr.find((o) => o.mesa_sesion?.mesa?.number != null)?.mesa_sesion?.mesa?.number;
          if (mesa == null) continue;
          if (!porMesa.has(mesa)) porMesa.set(mesa, []);
          porMesa.get(mesa).push({ key, arr });
        }
        const THRESHOLD_MS = 2 * 60 * 1000;
        for (const lista of porMesa.values()) {
          if (lista.length < 2) continue;
          lista.sort((a, b) => {
            const aTime = a.arr.reduce((min, it) => Math.min(min, new Date(it.createdAt).getTime()), Infinity);
            const bTime = b.arr.reduce((min, it) => Math.min(min, new Date(it.createdAt).getTime()), Infinity);
            return aTime - bTime;
          });
          let actual = lista[0];
          for (let i = 1; i < lista.length; i++) {
            const sig = lista[i];
            const finActual = actual.arr.reduce((max, it) => Math.max(max, new Date(it.updatedAt).getTime()), 0);
            const inicioSig = sig.arr.reduce((min, it) => Math.min(min, new Date(it.createdAt).getTime()), Infinity);
            if (inicioSig - finActual <= THRESHOLD_MS) {
              actual.arr.push(...sig.arr);
              grupos.delete(sig.key);
            } else {
              actual = sig;
            }
          }
        }
      }

      const cuentasArr = Array.from(grupos, ([groupKey, arr]) => {
        const hasUnpaid = arr.some((o) => o.order_status !== 'paid');
        const lista = hasUnpaid ? arr.filter((o) => o.order_status !== 'paid') : arr;
        const total = lista.reduce((sum, it) => sum + Number(it.total || 0), 0);
        const lastUpdated = arr.reduce((max, it) => Math.max(max, new Date(it.updatedAt).getTime()), 0);
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
          mesaSesionCode: arr.find((x) => x?.mesa_sesion?.code)?.mesa_sesion?.code ?? null,
        };
      });

      const filtradas = showHistory
        ? cuentasArr.filter((c) => !c.hasUnpaid).sort((a, b) => b.lastUpdated - a.lastUpdated)
        : cuentasArr.filter((c) => c.hasUnpaid).sort((a, b) => {
            const am = Number.isFinite(Number(a.mesaNumber)) ? Number(a.mesaNumber) : 999999;
            const bm = Number.isFinite(Number(b.mesaNumber)) ? Number(b.mesaNumber) : 999999;
            return am - bm;
          });

        updateCachedView(visibles, filtradas);

      setCuentas(filtradas);
      setError(null);
    } catch (err) {
      console.error('Error al obtener pedidos:', err?.response?.data || err);
      setError('No se pudieron cargar los pedidos.');
    }
  };

  // ----- polling -----
  useEffect(() => {
    seenIdsRef.current = new Set(); // reset de vistos al cambiar de restaurante
    cachedViewsRef.current = {
      active: { pedidos: [], cuentas: [] },
      history: { pedidos: [], cuentas: [] },
    };
  }, [slug]);

  const prevShowHistoryRef = useRef(showHistory);
  useEffect(() => {
    if (!prevShowHistoryRef.current && showHistory) {
      pendingBeforeHistoryRef.current = new Set(
        pedidosRef.current
          .filter((p) => p.order_status === 'pending')
          .map((p) => p.id)
      );
    }
    prevShowHistoryRef.current = showHistory;
  }, [showHistory]);

  useEffect(() => {
    const modeKey = showHistory ? 'history' : 'active';
    const cached = cachedViewsRef.current[modeKey] ?? { pedidos: [], cuentas: [] };
    const nextPedidos = Array.isArray(cached.pedidos) ? [...cached.pedidos] : [];
    const nextCuentas = Array.isArray(cached.cuentas) ? [...cached.cuentas] : [];
    pedidosRef.current = nextPedidos;
    setPedidos(nextPedidos);
    setCuentas(nextCuentas);
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, showHistory]);

  // marcar que ya hubo al menos una carga
  useEffect(() => { hasLoadedRef.current = true; }, []);

  // ---- acciones ----
    const putEstado = async (pedido, estado) => {
    const id = typeof pedido === 'object' ? pedido?.id : pedido;
    const itemIds =
      typeof pedido === 'object'
        ? (pedido?.items || []).map((it) => it?.id).filter(Boolean)
        : [];

    if (id == null) throw new Error('Pedido sin id');

    try {
      await api.patch(`/pedidos/${id}`, { data: { order_status: estado } });
    } catch (err) {
      if (err?.response?.status === 405) {
        const data = { order_status: estado };
        if (itemIds.length > 0) data.items = itemIds;
        await api.put(`/pedidos/${id}`, { data });
        return;
      }
      throw err;
    }  };

  const refreshItemsDe = async (orderId) => {
    try {
      const items = await fetchItemsDePedido(orderId);
      if (items?.length) {
        setPedidos((prev) => {
          const next = prev.map((p) => (p.id === orderId ? { ...p, items } : p));
          pedidosRef.current = next;
          updateCachedView(next);
          return next;
        });
      }
    } catch {}
  };

  const marcarComoRecibido = async (pedido) => {
    try {
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'preparing' } : p
        );
        pedidosRef.current = next;
         updateCachedView(next);
        return next;
      });
      triggerFlash(pedido.documentId);
      await putEstado(pedido, 'preparing');
      await refreshItemsDe(pedido.id);
    } catch (err) {
      console.error('Error al marcar como Recibido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      setPedidos((prev) => {
        const next = prev.map((p) =>
          keyOf(p) === keyOf(pedido) ? { ...p, order_status: 'pending' } : p
        );
        pedidosRef.current = next;
        updateCachedView(next);
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
      await putEstado(pedido, 'served');
      await fetchPedidos();
    } catch (err) {
      console.error('Error al marcar como servido:', err?.response?.data || err);
      setError('No se pudo actualizar el pedido.');
      servingIdsRef.current.delete(pedido.id);
      setPedidos((prev) => {
        if (prev.some((p) => keyOf(p) === keyOf(pedido))) return prev;
        const next = [pedido, ...prev];
        pedidosRef.current = next;
        updateCachedView(next);
        return next;
      });
    }
  };

  // ---- memos de filtro ----
  const pedidosFiltrados = useMemo(
    () => pedidos.filter(pedidoMatchesMesaPartial),
    [pedidos, mesaTokens]
  );
  const cuentasFiltradas = useMemo(
    () => cuentas.filter(cuentaMatchesMesaPartial),
    [cuentas, mesaTokens]
  );
  const noResultsPedidos =
    !error && pedidos.length > 0 && pedidosFiltrados.length === 0 && mesaTokens.length > 0;
  const noResultsCuentas =
    cuentas.length > 0 && cuentasFiltradas.length === 0 && mesaTokens.length > 0;

  // ---- UI ----
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Encabezado minimal + barrita */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            component="h1"
            sx={(theme) => ({
              fontSize: { xs: 26, sm: 32 },
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: 0.5,
              fontFamily: theme.typography.fontFamily,
              color: 'text.primary',
              mb: 0.5,
            })}
          >
            Mostrador — {slug?.toUpperCase?.()} {showHistory ? '(Historial)' : ''}
          </Typography>
          <Box sx={{ height: 2, width: 120, bgcolor: 'divider', borderRadius: 1, position: 'relative' }}>
            <Box
              sx={(theme) => ({
                position: 'absolute',
                left: 0,
                top: -1,
                width: 44,
                height: 4,
                borderRadius: 999,
                backgroundColor: theme.palette.primary.main,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              })}
            />
          </Box>
        </Box>

        <TextField
          size="small"
          label="Buscar por Nº de mesa"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 320 }, borderRadius: 2 }}
          InputProps={{
            startAdornment: <InputAdornment position="start">🔎</InputAdornment>,
            endAdornment: searchQuery ? (
              <InputAdornment
                position="end"
                sx={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
                title="Limpiar búsqueda"
              >
                ×
              </InputAdornment>
            ) : null,
          }}
          placeholder="Ej: 3  |  12  |  12 33"
        />

        <Button
          variant="outlined"
          onClick={() => setShowHistory((s) => !s)}
          sx={{ borderRadius: 2, px: 2.5 }}
        >
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
          {noResultsPedidos && (
            <Typography sx={{ mb: 1 }}>
              No hay pedidos para las mesas que coinciden con tu búsqueda.
            </Typography>
          )}
          <Grid container spacing={2}>
            {pedidosFiltrados.map((pedido) => {
              const { id, documentId, order_status, customerNotes, items = [], total } = pedido;
              const mesaNumero = pedido.mesa_sesion?.mesa?.number;
              const flashing = flashIds.has(documentId);
              const tituloMesa = `Mesa ${mesaNumero ?? 's/n'}`;

              // chip de estado (colores suaves)
              const estadoSx = {
                px: 1,
                py: 0.25,
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
                width: 'fit-content',
                color:
                  order_status === 'pending'
                    ? 'error.main'
                    : order_status === 'preparing'
                    ? 'warning.main'
                    : 'success.main',
                bgcolor:
                  order_status === 'pending'
                    ? 'rgba(244, 67, 54, 0.08)'
                    : order_status === 'preparing'
                    ? 'rgba(255, 193, 7, 0.12)'
                    : 'rgba(76, 175, 80, 0.10)',
              };

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
                      {/* Encabezado de la tarjeta: título + estado a la derecha */}
<Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
  <Typography variant="h6" sx={{ fontWeight: 600 }}>
    {tituloMesa}
  </Typography>

  <Box
    sx={{
      ...estadoSx,
      px: 1.5,
      py: 0.5,
      fontSize: 13,
      borderRadius: 10,
      textTransform: 'capitalize',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
    }}
  >
    {order_status || 'No definido'}
  </Box>
</Box>


                      {customerNotes && (
                        <Typography variant="body2" sx={{ mt: 1.25 }}>
                          <strong>Notas:</strong> {customerNotes}
                        </Typography>
                      )}

                      <Divider sx={{ my: 1.25 }} />

                      <List sx={{ flexGrow: 1, py: 0 }}>
                        {items.map((item) => {
                          const prod = item?.product;
                          return (
                            <ListItem key={item.id} sx={{ px: 0, py: 0.5 }}>
                              <Typography variant="body2">
                                {prod?.name ? prod.name : 'Producto sin datos'}{' '}
                                <Box component="span" sx={{ color: 'text.secondary' }}>
                                  ×{item.quantity}
                                </Box>
                              </Typography>
                            </ListItem>
                          );
                        })}
                      </List>

                      <Typography
                        variant="subtitle1"
                        sx={{ textAlign: 'right', mb: 1, fontWeight: 600, letterSpacing: 0.2 }}
                      >
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
                              sx={{ borderRadius: 2 }}
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
                              sx={{ borderRadius: 2 }}
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
          <Box sx={{ mb: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {showHistory ? 'Cuentas pagadas' : 'Cuentas'}
            </Typography>
            <Box sx={{ height: 2, width: 80, bgcolor: 'divider', borderRadius: 1, mt: 0.5 }} />
          </Box>

          {noResultsCuentas && (
            <Typography sx={{ mb: 1 }}>
              No hay cuentas para las mesas que coinciden con tu búsqueda.
            </Typography>
          )}
          {cuentasFiltradas.map((c) => (
            <Card key={c.groupKey} sx={{ mb: 2, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Mesa {c.mesaNumber ?? 's/n'}
                </Typography>
                <Box sx={{ height: 2, width: 36, bgcolor: 'divider', borderRadius: 1, my: 0.5 }} />
                <List sx={{ py: 0 }}>
                  {c.pedidos.map((p) => (
                    <ListItem key={p.documentId || p.id} sx={{ px: 0, py: 0.5 }}>
                      <Typography variant="body2">Pedido {p.id} — {money(p.total)}</Typography>
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" sx={{ textAlign: 'right', fontWeight: 600 }}>
                  Total: {money(c.total)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}