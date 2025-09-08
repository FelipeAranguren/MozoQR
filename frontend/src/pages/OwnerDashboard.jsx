// src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SalesByDayChart from '../components/SalesByDayChart';

import {
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
  fetchRecentPaidOrders,
  fetchTopProducts,
} from '../api/analytics';

const money = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const PERIODS = [
  { key: '7d',  label: '7 días',   computeStart: (end) => addDays(end, -6) },
  { key: '15d', label: '15 días',  computeStart: (end) => addDays(end, -14) },
  { key: '30d', label: '30 días',  computeStart: (end) => addDays(end, -29) },
  { key: '6m',  label: '6 meses',  computeStart: (end) => addMonths(end, -6) },
  { key: '1y',  label: '12 meses', computeStart: (end) => addMonths(end, -12) },
];

function addDays(base, d) { const x = new Date(base); x.setDate(x.getDate() + d); return x; }
function addMonths(base, m) {
  const x = new Date(base);
  const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  return x;
}

const prettyName = (s = '') => s.replaceAll('-', ' ').toUpperCase();

export default function OwnerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [periodKey, setPeriodKey] = useState('7d');
  const [periodTotal, setPeriodTotal] = useState(0);

  const end = useMemo(() => new Date(), [periodKey]);
  const periodDef = useMemo(() => PERIODS.find(p => p.key === periodKey) || PERIODS[0], [periodKey]);
  const start = useMemo(() => periodDef.computeStart(end), [periodDef, end]);

  // Fechas estables para pasar al chart
  const startStable = useMemo(() => new Date(start.getTime()), [start]);
  const endStable   = useMemo(() => new Date(end.getTime()),   [end]);

  const startMs = startStable.getTime();
  const endMs   = endStable.getTime();

  const [periodOrders, setPeriodOrders] = useState([]);
  const [lifetimeOrders, setLifetimeOrders] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);

  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getPaidOrders({ slug, from: startStable, to: endStable });
        if (!cancelled) setPeriodOrders(list || []);
      } catch {
        if (!cancelled) setPeriodOrders([]);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, startMs, endMs]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const total = await getTotalOrdersCount({ slug });
        if (!cancelled) setLifetimeOrders(total);
      } catch {
        if (!cancelled) setLifetimeOrders(0);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const total = await getSessionsCount({ slug, from: startStable, to: endStable });
        if (!cancelled) setSessionsCount(total);
      } catch {
        if (!cancelled) setSessionsCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, startMs, endMs]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchRecentPaidOrders({ slug, limit: 5 });
        if (!cancelled) {
          if (rows && rows.length) setRecentOrders(rows);
          else {
            const fallback = [...periodOrders]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 5)
              .map((a) => ({
                id: a.id,
                total: a.total,
                mesa: a.tableNumber ?? (a.table && a.table.number) ?? a.tableSessionId ?? '—',
                createdAt: a.createdAt,
              }));
            setRecentOrders(fallback);
          }
        }
      } catch {
        if (!cancelled) setRecentOrders([]);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, periodOrders]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchTopProducts({ slug, from: startStable, to: endStable, limit: 5 });
        if (!cancelled) setTopProducts(rows || []);
      } catch {
        if (!cancelled) setTopProducts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, startMs, endMs]);

  const ingresosHoy = useMemo(() => {
    const today = new Date();
    const sameLocalDay = (d) => {
      const a = new Date(d);
      return a.getFullYear() === today.getFullYear()
        && a.getMonth() === today.getMonth()
        && a.getDate() === today.getDate();
    };
    return periodOrders
      .filter((o) => o.createdAt && sameLocalDay(o.createdAt))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
  }, [periodOrders]);

  const pedidosPeriodo = periodOrders.length;
  const ticketPromedio = pedidosPeriodo ? (periodTotal / pedidosPeriodo) : 0;

  if (!slug) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Seleccioná un restaurante</h2>
        <button onClick={() => navigate('/owner/mcdonalds/dashboard')}>Ir a McDonalds</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>
          Ventas en los últimos {periodDef.label} — 
        </h2>
        <div style={{ opacity: 0.7 }}>({prettyName(slug)})</div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodKey(p.key)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: p.key === periodKey ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                background: p.key === periodKey ? '#e0f2fe' : '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fila 1 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 520px',
          gridAutoRows: 'minmax(360px, auto)',
          gap: 16,
          alignItems: 'stretch',
          marginBottom: 16,
        }}
      >
        {/* Gráfico (safe) */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <SalesByDayChart
            slug={slug}
            start={startStable}
            end={endStable}
            periodKey={periodKey}
            onTotalChange={setPeriodTotal}
          />
        </div>

        {/* KPIs */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 16,
            padding: 20,
            minHeight: 0,
            overflow: 'visible',
          }}
        >
          <KpiBox
            title="Ingresos del Día"
            value={Number(ingresosHoy) || 0}
            formatter={money}
            resetKey={periodKey}
          />
          <KpiBox
            title="Pedidos Completados"
            value={Number(lifetimeOrders) || 0}
            formatter={(n) => String(Math.round(n))}
            resetKey={periodKey}
          />
          <KpiBox
            title="Ticket Promedio"
            value={Number(ticketPromedio) || 0}
            formatter={money}
            resetKey={periodKey}
          />
          <KpiBox
            title="Clientes Atendidos"
            value={Number(sessionsCount) || 0}
            formatter={(n) => String(Math.round(n))}
            resetKey={periodKey}
          />
        </div>
      </div>

      {/* Fila 2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 520px',
          gridAutoRows: 'minmax(360px, auto)',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Últimos pedidos</h3>
          <OrdersTable rows={recentOrders} />
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Top productos del período</h3>
          <TopProductsList rows={topProducts} />
        </div>
      </div>
    </div>
  );
}

/** KPI con “counter up” */
function KpiBox({ title, value, formatter, resetKey }) {
  const isIngresos = title === 'Ingresos del Día';
  const [display, setDisplay] = useState(0);

  // Animación de 0 -> value con easing suave
  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 900; // ms
    const start = performance.now();
    let raf;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(p);
      setDisplay(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    setDisplay(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // resetKey permite reiniciar al cambiar período
  }, [value, resetKey]);

  const show = formatter ? formatter(display) : String(Math.round(display));

  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minWidth: 0,
        overflow: 'visible',
        background: '#fff',
      }}
    >
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div
        style={{
          fontWeight: 800,
          lineHeight: 1.05,
          fontSize: isIngresos ? 'clamp(22px, 3vw, 36px)' : 'clamp(28px, 5vw, 30px)',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}
        title={formatter ? formatter(value) : String(value)}
      >
        {show}
      </div>
    </div>
  );
}

function OrdersTable({ rows }) {
  if (!rows || !rows.length) {
    return <div style={{ color: '#6b7280' }}>Sin pedidos recientes.</div>;
  }
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}># Pedido</th>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Mesa</th>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.id}</td>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.mesa || '—'}</td>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                {money(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopProductsList({ rows }) {
  if (!rows || !rows.length) {
    return <div style={{ color: '#6b7280' }}>Sin datos de productos en este período.</div>;
  }
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Producto</th>
            <th style={{ padding: '8px 6px', borderBottom: '1px solid #e5e7eb' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.name || 'producto') + '-' + i}>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9' }}>{r.name}</td>
              <td style={{ padding: '10px 6px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                {r.qty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
