// src/pages/OwnerDashboard.jsx
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SalesByDayChart from '../components/SalesByDayChart';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

const PERIODS = [
  { key: '7d',  label: '7 días',   computeStart: (end) => addDays(end, -7) },
  { key: '15d', label: '15 días',  computeStart: (end) => addDays(end, -15) },
  { key: '30d', label: '30 días',  computeStart: (end) => addDays(end, -30) },
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

  const [periodKey, setPeriodKey] = useState('30d');

  // ¡Importante!: end siempre “ahora” (no memoizado) para no quedarse viejo
  const end = new Date();
  const { label: periodLabel, computeStart } =
    useMemo(() => PERIODS.find(p => p.key === periodKey) || PERIODS[2], [periodKey]);
  const start = useMemo(() => computeStart(end), [computeStart, end]);

  const [periodTotal, setPeriodTotal] = useState(0);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          Ventas en los últimos {periodLabel} — {money(periodTotal)}
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

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'minmax(320px, auto) minmax(320px, auto)',
          gap: 16,
        }}
      >
        {/* Gráfico ventas por día */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
          <SalesByDayChart
            slug={slug}
            start={start}
            end={end}
            periodKey={periodKey}
            onTotalChange={setPeriodTotal}
          />
        </div>

        <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fafafa' }} />
        <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fafafa' }} />
        <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fafafa' }} />
      </div>
    </div>
  );
}
