import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Skeleton, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../api';

const fmtHora = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const fmtMoney = (amount, currency = 'ARS') => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(n);
  } catch {
    return `${n}`;
  }
};

function getApiBaseForEventSource() {
  const base = (import.meta.env?.VITE_API_URL || 'http://localhost:1337/api').replace(/\/+$/, '');
  // EventSource needs the /api prefix included (we already have it in VITE_API_URL)
  return base;
}

export default function PagosRealtimeBar({ slug, localItems = [] }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const esRef = useRef(null);

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

  useEffect(() => {
    let alive = true;
    fetchNotifs({ showSkeleton: true });

    const poll = setInterval(() => {
      if (!alive) return;
      fetchNotifs({ showSkeleton: false });
    }, 5000);

    const onVis = () => {
      if (document.visibilityState === 'visible' && alive) {
        fetchNotifs({ showSkeleton: false });
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [slug, fetchNotifs]);

  useEffect(() => {
    if (!slug) return;

    const base = getApiBaseForEventSource();
    const url = `${base}/notificaciones/pagos/stream?slug=${encodeURIComponent(slug)}`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

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
    const out = [];
    const seen = new Set();
    for (const x of localItems || []) {
      const m = Number(x?.mesaNumber);
      if (!Number.isFinite(m) || seen.has(m)) continue;
      seen.add(m);
      out.push({ ...x, _fromLocal: true });
    }
    for (const x of items || []) {
      if (out.length >= 3) break;
      const m = Number(x?.mesaNumber);
      if (!Number.isFinite(m) || seen.has(m)) continue;
      seen.add(m);
      out.push({ ...x, _fromLocal: false });
    }
    return out.slice(0, 3);
  }, [localItems, items]);

  const content = useMemo(() => {
    if (loading && !merged.length) {
      return (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Skeleton variant="rounded" width={210} height={28} />
          <Skeleton variant="rounded" width={210} height={28} />
          <Skeleton variant="rounded" width={210} height={28} />
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
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {merged.map((n, idx) => {
          const money = fmtMoney(n.amount, n.currency || 'ARS');
          const hora = fmtHora(n.paidAt);
          const label = n._fromLocal
            ? `La mesa ${n.mesaNumber} fue pagada${money ? ` (${money})` : ''}${hora ? ` · ${hora}` : ''}`
            : `Mesa ${n.mesaNumber} — Pagado${money ? ` (${money})` : ''}${hora ? ` a las ${hora}` : ''}`;
          return (
            <Chip
              key={n.key || `${n.mesaNumber}-${n.paidAt}-${idx}`}
              icon={<CheckCircleIcon />}
              label={label}
              variant="filled"
              sx={{
                height: 30,
                borderRadius: 999,
                fontWeight: 600,
                bgcolor: 'rgba(46, 125, 50, 0.10)',
                color: 'success.dark',
                border: '1px solid rgba(46, 125, 50, 0.20)',
                backdropFilter: 'blur(6px)',
                '& .MuiChip-icon': { color: 'success.main' },
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
        px: 1.25,
        py: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 46,
        width: '100%',
        maxWidth: { xs: '100%', sm: 640, md: 760 },
        boxShadow: '0 6px 22px rgba(0,0,0,0.06)',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          letterSpacing: 0.2,
          color: 'text.primary',
          whiteSpace: 'nowrap',
        }}
      >
        Pagos:
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>{content}</Box>
    </Box>
  );
}

