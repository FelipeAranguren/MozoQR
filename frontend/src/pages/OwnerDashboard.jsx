// src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SalesByDayChart from '../components/SalesByDayChart';
import {
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
} from '../api/analytics';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const PERIODS = [
  { key: '7d',  label: '7 días',   computeStart: (end) => addDays(end, -6) }, // incluye hoy
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

const prettyName = (s='') => s.replaceAll('-', ' ').toUpperCase();

export default function OwnerDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [periodKey, setPeriodKey] = useState('7d'); // por defecto 7d
  const [periodTotal, setPeriodTotal] = useState(0); // total del período (desde el gráfico)

  // end se fija por período para evitar renders infinitos
  const end = useMemo(() => new Date(), [periodKey]);
  const periodDef = useMemo(
    () => PERIODS.find(p => p.key === periodKey) || PERIODS[0],
    [periodKey]
  );
  const start = useMemo(() => periodDef.computeStart(end), [periodDef, end]);

  // Para deps estables
  const startMs = start.getTime();
  const endMs = end.getTime();

  // KPIs
  const [periodOrders, setPeriodOrders] = useState([]);     // pedidos del rango
  const [lifetimeOrders, setLifetimeOrders] = useState(0);  // total histórico
  const [sessionsCount, setSessionsCount] = useState(0);    // sesiones del rango (clientes)

  // Carga pedidos del período (MISMO QS que el gráfico) — POR RESTAURANTE
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getPaidOrders({ slug, from: new Date(startMs), to: new Date(endMs) });
        if (!cancelled) setPeriodOrders(list || []);
      } catch {
        if (!cancelled) setPeriodOrders([]);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, startMs, endMs]);

  // Carga total histórico (lifetime) — POR RESTAURANTE
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

  // Carga cantidad de sesiones (clientes atendidos) del período — POR RESTAURANTE
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const total = await getSessionsCount({ slug, from: new Date(startMs), to: new Date(endMs) });
        if (!cancelled) setSessionsCount(total);
      } catch {
        if (!cancelled) setSessionsCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, startMs, endMs]);

  // === Derivados (basado en createdAt) ===
  const ingresosHoy = useMemo(() => {
    const today = new Date();
    const sameLocalDay = (d) => {
      const a = new Date(d);
      return a.getFullYear() === today.getFullYear()
        && a.getMonth() === today.getMonth()
        && a.getDate() === today.getDate();
    };
    return periodOrders
      .filter(o => o.createdAt && sameLocalDay(o.createdAt))
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
          Ventas en los últimos {periodDef.label} — {money(periodTotal)}
        </h2>
        <div style={{ opacity: 0.7 }}>({prettyName(slug)})</div>

        {/* Selector de período */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
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

      {/* Una fila: izquierda gráfico, derecha KPIs ocupando TODO el alto */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 520px',
          gridAutoRows: 'minmax(360px, auto)',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* Gráfico */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <SalesByDayChart
            slug={slug}
            start={new Date(startMs)}
            end={new Date(endMs)}
            periodKey={periodKey}
            onTotalChange={setPeriodTotal}
          />
        </div>

        {/* KPIs (2x2) */}
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
          <KpiBox title="Ingresos del Día" value={money(ingresosHoy)} />
          <KpiBox title="Pedidos Completados" value={String(lifetimeOrders)} />
          <KpiBox title="Ticket Promedio" value={money(ticketPromedio)} />
          <KpiBox title="Clientes Atendidos" value={String(sessionsCount)} />
        </div>
      </div>
    </div>
  );
}

/** Caja simple para KPI con tipografía responsiva */
function KpiBox({ title, value }) {
  const isIngresos = title === 'Ingresos del Día';
  return (
    <div style={{
      border: '1px solid #f0f0f0',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minWidth: 0,
      overflow: 'visible',
      background: '#fff'
    }}>
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div
        style={{
          fontWeight: 800,
          lineHeight: 1.05,
          fontSize: isIngresos ? 'clamp(22px, 3vw, 36px)' : 'clamp(28px, 5vw, 48px)',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
