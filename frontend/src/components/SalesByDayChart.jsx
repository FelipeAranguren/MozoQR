// src/components/SalesByDayChart.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesByDay } from '../api/analytics';

function money(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);
}
function toLocalDate(ymd) { return new Date(`${ymd}T00:00:00`); }

const fmtWeekdayShort = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });
const fmtMonthShort   = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const fmtMonthLong    = new Intl.DateTimeFormat('es-AR', { month: 'long' });

function monthKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function enumerateLastNMonths(endDate, n) {
  const arr = []; let y = endDate.getFullYear(); let m = endDate.getMonth();
  for (let i = 0; i < n; i++) { arr.push({ y, m }); if (--m < 0) { m = 11; y--; } }
  return arr.reverse();
}
function niceCeilAbove(n) {
  if (!isFinite(n) || n <= 0) return 1;
  const e = Math.floor(Math.log10(n)), base = Math.pow(10, e), m = n / base;
  const steps = [1, 2, 5, 10]; const s = steps.find(x => x > m);
  return (s ? s : 10) * base;
}

export default function SalesByDayChart({ slug, start, end, periodKey = '30d', onTotalChange }) {
  const [series, setSeries] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Hover para tooltip “pill”
  const [hoverIdx, setHoverIdx] = useState(null);

  // Control de animación al cambiar período
  const [animPlay, setAnimPlay] = useState(false);
  const [animEpoch, setAnimEpoch] = useState(0); // cambia para reiniciar la entrada

  // respeta reduced motion
  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const startDate = useMemo(() => (start instanceof Date ? start : new Date(start)), [start]);
  const endDate   = useMemo(() => (end   instanceof Date ? end   : new Date(end)),   [end]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetchSalesByDay(slug, { start: startDate, end: endDate });
        if (!alive) return;
        setSeries(resp.series || []);
        const total = resp.grandTotal || 0;
        setGrandTotal(total);
        onTotalChange?.(total);
        setErr(null);
      } catch {
        if (!alive) return;
        setSeries([]); setGrandTotal(0); onTotalChange?.(0);
        setErr('No se pudieron cargar las ventas');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [slug, startDate, endDate, onTotalChange]);

  const daily = useMemo(() => {
    try { return (series || []).map(r => ({ d: toLocalDate(r.date), total: Number(r.total) || 0 })); }
    catch { return []; }
  }, [series]);

  const is12m = periodKey === '1y' || periodKey === '12m' || periodKey === '12months';
  const is6m  = periodKey === '6m' || periodKey === 'halfyear';

  const plot = useMemo(() => {
    if (is12m) {
      const months = enumerateLastNMonths(endDate, 12);
      const byMonth = new Map(months.map(({ y, m }) => [monthKey(y, m), 0]));
      for (const it of daily) {
        const k = monthKey(it.d.getFullYear(), it.d.getMonth());
        if (byMonth.has(k)) byMonth.set(k, byMonth.get(k) + (Number(it.total) || 0));
      }
      const bars = months.map(({ y, m }) => {
        const total = byMonth.get(monthKey(y, m)) || 0;
        const dateRef = new Date(y, m, 1);
        return { total, dateRef, xLabel: fmtMonthShort.format(dateRef) };
      });
      return { type: 'monthly', bars, monthSpans: [] };
    }

    if (is6m) {
      const months = enumerateLastNMonths(endDate, 6);
      const byMonth = new Map(months.map(({ y, m }) => [monthKey(y, m), []]));
      for (const it of daily) {
        const k = monthKey(it.d.getFullYear(), it.d.getMonth());
        if (byMonth.has(k)) byMonth.get(k).push(it);
      }
      const bars = []; const spans = []; let idx = 0;
      for (const { y, m } of months) {
        const arr = byMonth.get(monthKey(y, m)) || [];
        const dim = daysInMonth(y, m), cut = Math.ceil(dim / 2);
        let first = 0, second = 0;
        for (const x of arr) { (x.d.getDate() <= cut ? (first += +x.total || 0) : (second += +x.total || 0)); }
        const dateRef = new Date(y, m, 1);
        bars.push({ total: first,  dateRef, half: 1 });
        bars.push({ total: second, dateRef, half: 2 });
        spans.push({ leftPct: (idx / (months.length * 2)) * 100, widthPct: (2 / (months.length * 2)) * 100, label: fmtMonthShort.format(dateRef) });
        idx += 2;
      }
      return { type: 'half-months', bars, monthSpans: spans };
    }

    if (['7d', '15d', '30d'].includes(periodKey)) {
      const items = daily;
      const monthSpans = (() => {
        if (periodKey === '7d' || !items.length) return [];
        const spans = []; let curStart = 0, curMonth = items[0].d.getMonth(), curYear = items[0].d.getFullYear();
        for (let i = 1; i < items.length; i++) {
          const m = items[i].d.getMonth(), y = items[i].d.getFullYear();
          if (m !== curMonth || y !== curYear) { spans.push({ start: curStart, end: i - 1 }); curStart = i; curMonth = m; curYear = y; }
        }
        spans.push({ start: curStart, end: items.length - 1 });
        const n = Math.max(items.length, 1);
        return spans.map(s => {
          const count = (s.end - s.start + 1);
          const leftPct = (s.start / n) * 100, widthPct = (count / n) * 100;
          const anyDate = items[s.start].d;
          return { leftPct, widthPct, label: `${fmtMonthLong.format(anyDate)} ${anyDate.getFullYear()}` };
        });
      })();
      const bars = items.map(it => ({ total: it.total, dateRef: it.d }));
      return { type: 'daily', bars, monthSpans };
    }

    return { type: 'daily', bars: daily.map(it => ({ total: it.total, dateRef: it.d })), monthSpans: [] };
  }, [is12m, is6m, periodKey, daily, endDate]);

  // Cuando el período o las barras cambian, disparamos la animación
  useEffect(() => {
    setAnimPlay(false);           // resetea a altura 0
    setAnimEpoch(e => e + 1);     // cambia clave para re-montaje visual
    const t = setTimeout(() => setAnimPlay(true), 30); // siguiente frame -> animar a altura real
    return () => clearTimeout(t);
  }, [periodKey, plot?.bars?.length]);

  const barValuesMax = useMemo(() => (plot?.bars || []).reduce((m, b) => Math.max(m, +b.total || 0), 0), [plot]);
  const yMax  = useMemo(() => Math.max(1, niceCeilAbove(barValuesMax)), [barValuesMax]);
  const yTicks = useMemo(() => [0, .2, .4, .6, .8, 1].map(p => ({ p, value: Math.round(yMax * p) })), [yMax]);

  const COLORS = {
    text: '#374151', textMuted: '#6b7280', grid: '#e5e7eb', axis: '#d1d5db',
    barTop: '#bfdbfe', barBottom: '#93c5fd', barHover: '#60a5fa', panelBg: '#ffffff'
  };
  const LEFT_GUTTER = 70, BAR_AREA_H = 240;

  const STAGGER_MS = prefersReduced ? 0 : 28;     // retardo por barra
  const DURATION_MS = prefersReduced ? 0 : 460;   // duración del “grow”
  const EASING = 'cubic-bezier(.16,.84,.24,1)';   // ease-out con rebote leve

  function dayLabel(date) {
    if (!date) return '';
    if (periodKey === '7d')  return fmtWeekdayShort.format(date).replace('.', '');
    if (periodKey === '15d') return String(date.getDate());
    if (periodKey === '30d') { const d = date.getDate(); return ((d - 1) % 3 === 0) ? String(d) : ''; }
    return '';
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto' }}>
      {/* Keyframes inline (una vez) */}
      <style>{`
        @keyframes bar-pop {
          0%   { transform: translateY(6px) scaleY(0.92); opacity: .0; }
          60%  { transform: translateY(0)    scaleY(1.02); opacity: 1; }
          100% { transform: translateY(0)    scaleY(1.0);  opacity: 1; }
        }
      `}</style>

      <div style={{ marginBottom: 10, fontWeight: 700, color: COLORS.text }}>
        Total del período: {money(grandTotal)}
      </div>

      <div
        style={{
          position: 'relative',
          height: 350,
          border: '1px solid #eef2f7',
          borderRadius: 14,
          background: COLORS.panelBg,
          padding: 14,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)' }}>
            Cargando ventas…
          </div>
        )}

        {!loading && err && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'crimson' }}>
            {err}
          </div>
        )}

        {!loading && !err && (!plot?.bars || plot.bars.length === 0) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textMuted }}>
            No hay ventas en el período seleccionado.
          </div>
        )}

        {!loading && !err && plot?.bars?.length > 0 && (
          <div key={animEpoch} style={{ position: 'relative', height: '100%' }}>
            {/* Grilla + eje Y */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: BAR_AREA_H }}>
              <div style={{ position: 'absolute', left: LEFT_GUTTER, top: 0, bottom: 0, borderLeft: `1px solid ${COLORS.axis}` }} />
              {yTicks.map((t, i) => {
                const y = (1 - t.p) * BAR_AREA_H, isZero = t.p === 0;
                return (
                  <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                    <div style={{
                      position: 'absolute', left: 0, width: LEFT_GUTTER - 10, textAlign: 'right',
                      fontSize: 12, fontWeight: t.p === 1 ? 600 : 500, color: t.p === 1 ? COLORS.text : COLORS.textMuted,
                      transform: 'translateY(-50%)'
                    }}>
                      {money(t.value)}
                    </div>
                    {!isZero && (<div style={{ marginLeft: LEFT_GUTTER, height: 0, borderTop: `1px dashed ${COLORS.grid}` }} />)}
                  </div>
                );
              })}
            </div>

            {/* Barras con animación de entrada y transición de altura */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'end', height: BAR_AREA_H, marginTop: 12, marginLeft: LEFT_GUTTER, paddingRight: 8 }}>
              {plot.bars.map((b, idx) => {
                const total = Number(b?.total) || 0;
                const h = Math.max(0, Math.min(1, total / yMax)) * BAR_AREA_H;
                const active = hoverIdx === idx;

                const delay = `${idx * STAGGER_MS}ms`;

                return (
                  <div key={idx} style={{ flex: 1, minWidth: 6, position: 'relative' }}>
                    {/* PILL (igual que antes) */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: Math.round(animPlay ? h : 0) + 8,
                        transform: `translateX(-50%) scale(${active ? 1 : 0.96})`,
                        opacity: active ? 1 : 0,
                        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
                        background: 'rgba(17,24,39,0.92)',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.18)',
                        pointerEvents: 'none'
                      }}
                    >
                      {money(total)}
                      <span
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: -6,
                          transform: 'translateX(-50%)',
                          width: 0, height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid rgba(17,24,39,0.92)'
                        }}
                      />
                    </div>

                    {/* BARRA animada */}
                    <div
                      title={money(total)}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      style={{
                        height: Math.round(animPlay ? h : 0),            // “grow” de 0 a h
                        backgroundImage: 'linear-gradient(180deg, #bfdbfe, #93c5fd)',
                        borderRadius: 8,
                        transition: `height ${DURATION_MS}ms ${EASING}`,
                        animation: prefersReduced ? 'none' : `bar-pop ${Math.max(220, DURATION_MS-120)}ms ${EASING} both`,
                        animationDelay: delay,
                        boxShadow: active ? '0 6px 14px rgba(0,0,0,0.07)' : '0 1px 0 rgba(0,0,0,0.02)',
                        transform: active ? 'translateY(-2px)' : 'translateY(0)',
                        cursor: 'default'
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Meses arriba (si corresponde) */}
            {plot.monthSpans?.length > 0 && (
              <div style={{ position: 'relative', height: 24, marginTop: 8, marginLeft: LEFT_GUTTER }}>
                {plot.monthSpans.map((s, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${s.leftPct}%`, width: `${s.widthPct}%`,
                    textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.text,
                    letterSpacing: 0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
        (Vista segura sin chart.js, período: {periodKey})
      </div>
    </div>
  );
}
