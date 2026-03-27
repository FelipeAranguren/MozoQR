import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Chip, Skeleton, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../api';

const PAID_LOOKBACK_MS = 45 * 60 * 1000;

function getApiBaseForEventSource() {
  const base = (import.meta.env?.VITE_API_URL || 'http://localhost:1337/api').replace(/\/+$/, '');
  return base;
}

/** Extrae mesa y datos desde respuesta Strapi (pedido paid) */
function parsePedidoPaidRow(row) {
  const a = row?.attributes || row;
  if (!a) return null;
  const st = String(a.order_status || '').toLowerCase();
  if (st !== 'paid') return null;

  const cn = (a.customerNotes || '').toUpperCase();
  if (cn.includes('SOLICITUD DE COBRO') || cn.includes('LLAMAR MOZO') || cn.includes('SOLICITA COBRAR')) {
    return null;
  }

  let mesaNumber = a.mesaNumber ?? null;
  const ses = a.mesa_sesion?.data || a.mesa_sesion;
  const sesAttrs = ses?.attributes || ses || {};
  let mesa = sesAttrs?.mesa?.data || sesAttrs?.mesa;
  const mesaAttrs = mesa?.attributes || mesa || {};
  if (mesaNumber == null) {
    mesaNumber = mesaAttrs.number ?? mesa?.number ?? mesaAttrs.numero ?? mesa?.numero ?? null;
  }
  const mn = Number(mesaNumber);
  if (!Number.isFinite(mn) || mn <= 0) return null;

  const updatedAt = a.updatedAt || a.publishedAt || new Date().toISOString();
  const docId = a.documentId || row.documentId || row.id;
  return {
    mesaNumber: mn,
    amount: Number(a.total) || 0,
    currency: 'ARS',
    paidAt: new Date(updatedAt).toISOString(),
    key: `paid-api-${docId}`,
    _fromPaidQuery: true,
  };
}

export default function PagosRealtimeBar({ slug, localItems = [] }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [paidRecent, setPaidRecent] = useState([]);

  const push = (notif) => {
    if (!notif?.mesaNumber) return;
    setItems((prev) => {
      const next = [notif, ...prev].slice(0, 3);
      return next;
    });
  };

  const fetchNotifs = useCallback(
    async (opts = { showSkeleton: false }) => {
      if (opts.showSkeleton) setLoading(true);
      try {
        const res = await api.get(`/notificaciones/pagos?slug=${encodeURIComponent(slug || '')}`);
        const data = res?.data?.data ?? [];
        setItems(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch {
        if (opts.showSkeleton) setItems([]);
      } finally {
        if (opts.showSkeleton) setLoading(false);
      }
    },
    [slug],
  );

  const fetchPaidRecent = useCallback(async () => {
    if (!slug) return;
    const baseQs = () => {
      const since = new Date(Date.now() - PAID_LOOKBACK_MS).toISOString();
      return (
        `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
        `&filters[order_status][$eq]=paid` +
        `&filters[updatedAt][$gte]=${encodeURIComponent(since)}` +
        `&publicationState=preview` +
        `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=total&fields[4]=updatedAt&fields[5]=mesaNumber&fields[6]=customerNotes` +
        `&populate[mesa_sesion][populate][mesa]=true` +
        `&sort[0]=updatedAt:desc` +
        `&pagination[pageSize]=25`
      );
    };
    const fallbackQs = () =>
      `?filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}` +
      `&filters[order_status][$eq]=paid` +
      `&publicationState=preview` +
      `&fields[0]=id&fields[1]=documentId&fields[2]=order_status&fields[3]=total&fields[4]=updatedAt&fields[5]=mesaNumber&fields[6]=customerNotes` +
      `&populate[mesa_sesion][populate][mesa]=true` +
      `&sort[0]=updatedAt:desc` +
      `&pagination[pageSize]=40`;

    try {
      let raw;
      try {
        const res = await api.get(`/pedidos${baseQs()}`);
        raw = res?.data?.data ?? [];
      } catch {
        const res = await api.get(`/pedidos${fallbackQs()}`);
        raw = res?.data?.data ?? [];
      }
      const cutoff = Date.now() - PAID_LOOKBACK_MS;
      const parsed = raw
        .map(parsePedidoPaidRow)
        .filter(Boolean)
        .filter((p) => new Date(p.paidAt).getTime() >= cutoff);
      const byMesa = new Map();
      parsed.forEach((p) => {
        const prev = byMesa.get(p.mesaNumber);
        if (!prev || new Date(p.paidAt) > new Date(prev.paidAt)) byMesa.set(p.mesaNumber, p);
      });
      setPaidRecent(Array.from(byMesa.values()).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).slice(0, 5));
    } catch {
      setPaidRecent([]);
    }
  }, [slug]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await Promise.all([fetchNotifs({ showSkeleton: true }), fetchPaidRecent()]);
      if (!alive) return;
    };
    run();

    const poll = setInterval(() => {
      if (!alive) return;
      fetchNotifs({ showSkeleton: false });
      fetchPaidRecent();
    }, 4000);

    const onVis = () => {
      if (document.visibilityState === 'visible' && alive) {
        fetchNotifs({ showSkeleton: false });
        fetchPaidRecent();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [slug, fetchNotifs, fetchPaidRecent]);

  useEffect(() => {
    if (!slug) return;

    const base = getApiBaseForEventSource();
    const url = `${base}/notificaciones/pagos/stream?slug=${encodeURIComponent(slug)}`;
    const es = new EventSource(url, { withCredentials: false });

    const onPago = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        push(payload);
      } catch {
        // ignore
      }
    };

    es.addEventListener('mp_payment_approved', onPago);
    return () => {
      try {
        es.removeEventListener('mp_payment_approved', onPago);
        es.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const merged = useMemo(() => {
    const candidates = [];
    for (const x of localItems || []) {
      const m = Number(x?.mesaNumber);
      if (!Number.isFinite(m)) continue;
      candidates.push({
        ...x,
        _fromLocal: true,
        _t: new Date(x.paidAt || Date.now()).getTime(),
      });
    }
    for (const x of paidRecent || []) {
      const m = Number(x?.mesaNumber);
      if (!Number.isFinite(m)) continue;
      candidates.push({
        ...x,
        _fromPaidQuery: true,
        _t: new Date(x.paidAt || Date.now()).getTime(),
      });
    }
    for (const x of items || []) {
      const m = Number(x?.mesaNumber);
      if (!Number.isFinite(m)) continue;
      candidates.push({
        ...x,
        _fromApi: true,
        _t: new Date(x.paidAt || Date.now()).getTime(),
      });
    }

    const byMesa = new Map();
    for (const c of candidates) {
      const m = Number(c.mesaNumber);
      const prev = byMesa.get(m);
      if (!prev || c._t > prev._t) byMesa.set(m, c);
    }
    return Array.from(byMesa.values())
      .sort((a, b) => b._t - a._t)
      .slice(0, 3)
      .map(({ _t, ...rest }) => rest);
  }, [localItems, paidRecent, items]);

  const content = useMemo(() => {
    if (loading && !merged.length) {
      return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Skeleton variant="rounded" width={56} height={10} />
          <Skeleton variant="rounded" width={56} height={10} />
          <Skeleton variant="rounded" width={56} height={10} />
        </Box>
      );
    }

    if (!merged?.length) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sin pagos recientes
        </Typography>
      );
    }

    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {merged.map((n, idx) => {
          const label = `Mesa ${n.mesaNumber}`;
          return (
            <Chip
              key={n.key || `${n.mesaNumber}-${n.paidAt}-${idx}`}
              icon={<CheckCircleIcon sx={{ fontSize: 10 }} />}
              label={label}
              size="small"
              variant="filled"
              sx={{
                height: 20,
                maxHeight: 20,
                borderRadius: 999,
                fontWeight: 600,
                fontSize: '0.65rem',
                lineHeight: 1,
                bgcolor: 'rgba(46, 125, 50, 0.10)',
                color: 'success.dark',
                border: '1px solid rgba(46, 125, 50, 0.35)',
                backdropFilter: 'blur(6px)',
                '& .MuiChip-icon': {
                  color: 'success.main',
                  marginLeft: '4px',
                  marginRight: '-2px',
                },
                '& .MuiChip-label': {
                  px: 0.5,
                  py: 0,
                },
              }}
            />
          );
        })}
      </Box>
    );
  }, [merged, loading]);

  return (
    <Box
      sx={{
        px: 1,
        py: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 36,
        width: '100%',
        maxWidth: { xs: '100%', sm: 640, md: 760 },
        boxShadow: '0 6px 22px rgba(0,0,0,0.06)',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 800,
          letterSpacing: 0.2,
          color: 'text.primary',
          whiteSpace: 'nowrap',
          fontSize: '0.7rem',
        }}
      >
        Pagos:
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>{content}</Box>
    </Box>
  );
}
