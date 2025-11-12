// src/components/SalesByDayChart.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSalesByDay } from '../api/analytics';

function money(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);
}
function moneyNoCents(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function toLocalDate(ymd) { return new Date(`${ymd}T00:00:00`); }

const fmtWeekdayShort = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });
const fmtMonthShort   = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const fmtMonthLong    = new Intl.DateTimeFormat('es-AR', { month: 'long' });

// Techo “inteligente” + headroom suave
function niceCeilSmart(n) {
  if (!isFinite(n) || n <= 0) return 1;
  const headroom = 1.04;
  const target   = n * headroom;
  const e = Math.floor(Math.log10(target));
  const base = Math.pow(10, e);
  const m = target / base;
  const steps = [1, 1.1, 1.2, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const s = steps.find(x => m <= x) ?? 10;
  return s * base;
}

// Animaciones
const easeOutBack = (t, s = 1.101) => 1 + ((t = t - 1) * t * ((s + 1) * t + s));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3); // counter-up

function monthKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function enumerateLastNMonths(endDate, n) {
  const arr = []; let y = endDate.getFullYear(); let m = endDate.getMonth();
  for (let i = 0; i < n; i++) { arr.push({ y, m }); if (--m < 0) { m = 11; y--; } }
  return arr.reverse();
}

export default function SalesByDayChart({ slug, start, end, periodKey = '30d', onTotalChange }) {
  const [series, setSeries] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  // Counter-up del total
  const [displayTotal, setDisplayTotal] = useState(0);
  const totalAnimRef = useRef({ raf: null, start: 0, duration: 900, from: 0, to: 0 });

  // Animación de barras
  const [animatedHeights, setAnimatedHeights] = useState([]);
  const animRef = useRef({ raf: null, start: 0, from: [], to: [], delayPerBar: 12, duration: 680 });

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

  // === Counter-up: re-animar al entrar, al cambiar período y/o total ===
  const totalAnimKey = useMemo(() => {
    const s = startDate?.toISOString()?.slice(0,10);
    const e = endDate?.toISOString()?.slice(0,10);
    return `${periodKey}|${s}|${e}|${grandTotal}`;
  }, [periodKey, startDate, endDate, grandTotal]);

  useEffect(() => {
    if (totalAnimRef.current.raf) cancelAnimationFrame(totalAnimRef.current.raf);

    const to = Number(grandTotal) || 0;
    const duration = Math.max(600, Math.min(1400, 700 + Math.log10(Math.max(10, to)) * 300));
    totalAnimRef.current = { raf: null, start: performance.now(), duration, from: 0, to };

    const step = (now) => {
      const { start, duration, from, to } = totalAnimRef.current;
      const p = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(p);
      setDisplayTotal(Math.round(from + (to - from) * eased));
      if (p < 1) {
        totalAnimRef.current.raf = requestAnimationFrame(step);
      } else {
        totalAnimRef.current.raf = null;
      }
    };
    totalAnimRef.current.raf = requestAnimationFrame(step);

    return () => {
      if (totalAnimRef.current.raf) cancelAnimationFrame(totalAnimRef.current.raf);
      totalAnimRef.current.raf = null;
    };
  }, [totalAnimKey]);

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

  const barValuesMax = useMemo(
    () => (plot?.bars || []).reduce((m, b) => Math.max(m, +b.total || 0), 0),
    [plot]
  );
  const yMax  = useMemo(() => Math.max(1, niceCeilSmart(barValuesMax)), [barValuesMax]);
  const yTicks = useMemo(
    () => [0, .2, .4, .6, .8, 1].map(p => ({ p, value: yMax * p })),
    [yMax]
  );

  // Estilos base
  const COLORS = {
    text: '#374151', textMuted: '#6b7280', grid: '#e5e7eb', axis: '#d1d5db',
    barTop: '#bfdbfe', barBottom: '#93c5fd', barHover: '#60a5fa', panelBg: '#ffffff'
  };
  const LEFT_GUTTER = 70, BAR_AREA_H = 240;
  const INNER_PAD = 8;          // separa la 1ª barra del eje Y

  // Altura usando el área completa para que coincida con el eje Y
  // Usamos BAR_AREA_H directamente para que las barras se alineen con las líneas de la grilla
  const valueToHeight = (val) => {
    const ratio = Math.max(0, Math.min(1, (Number(val) || 0) / yMax));
    return ratio * BAR_AREA_H;
  };

  // ANIMACIÓN (rAF + easing + stagger) de barras
  const animKey = useMemo(() => {
    const stamp = (plot?.bars || []).map(b => `${b.total}`).join('|');
    return `${periodKey}|${startDate?.toISOString()?.slice(0,10)}|${endDate?.toISOString()?.slice(0,10)}|${stamp}|${yMax}`;
  }, [periodKey, startDate, endDate, plot, yMax]);

  useEffect(() => {
    const bars = plot?.bars || [];
    const count = bars.length;

    const toHeights = bars.map(b => valueToHeight(b?.total));

    const duration = Math.max(520, Math.min(900, 520 + count * 12));
    const delayPerBar = Math.max(8, Math.min(18, 14 - Math.floor(count / 12)));
    const fromHeights = (animatedHeights.length === count) ? animatedHeights : new Array(count).fill(0);

    animRef.current.from = fromHeights;
    animRef.current.to = toHeights;
    animRef.current.duration = duration;
    animRef.current.delayPerBar = delayPerBar;
    animRef.current.start = performance.now();

    if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf);

    const step = (now) => {
      const t0 = animRef.current.start;
      const d = animRef.current.duration;
      const per = animRef.current.delayPerBar;
      const elapsed = now - t0;

      const next = toHeights.map((target, i) => {
        const local = Math.max(0, elapsed - i * per);
        const p = Math.min(1, local / d);
        const eased = easeOutBack(p);
        const from = fromHeights[i] || 0;
        const val = from + (target - from) * eased;
        return Math.min(val, BAR_AREA_H);
      });

      setAnimatedHeights(next);

      const totalNeeded = d + per * (count - 1);
      if (elapsed < totalNeeded) {
        animRef.current.raf = requestAnimationFrame(step);
      } else {
        setAnimatedHeights(toHeights);
        animRef.current.raf = null;
      }
    };

    animRef.current.raf = requestAnimationFrame(step);
    return () => {
      if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf);
      animRef.current.raf = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto' }}>
      <div style={{ marginBottom: 10, fontWeight: 700, color: COLORS.text }}>
        Total del período: {money(displayTotal)}
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
          <div style={{ position: 'relative', height: '100%' }}>
            {/* Grilla + eje Y */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 240 }}>
              <div style={{ position: 'absolute', left: 70, top: 0, bottom: 0, borderLeft: `1px solid ${COLORS.axis}` }} />
              {yTicks.map((t, i) => {
                const y = (1 - t.p) * 240, isZero = t.p === 0;
                return (
                  <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y }}>
                    <div style={{
                      position: 'absolute', left: 0, width: 60, textAlign: 'right',
                      fontSize: 12, fontWeight: t.p === 1 ? 600 : 500, color: t.p === 1 ? COLORS.text : COLORS.textMuted,
                      transform: 'translateY(-50%)'
                    }}>
                      {moneyNoCents(t.value)}

                    </div>
                    {!isZero && (<div style={{ marginLeft: 70, height: 0, borderTop: `1px dashed ${COLORS.grid}` }} />)}
                  </div>
                );
              })}
            </div>

            {/* Barras + tooltip */}
            <div style={{ 
              position: 'absolute', 
              left: 78, 
              right: 8, 
              top: 12, 
              height: BAR_AREA_H, 
              display: 'flex', 
              gap: 6, 
              alignItems: 'flex-end', 
              paddingRight: 0, 
              paddingLeft: 0 
            }}>
              {plot.bars.map((b, idx) => {
                const total = Number(b?.total) || 0;
                const hTarget = valueToHeight(total);
                const h = animatedHeights[idx] != null 
                  ? Math.min(animatedHeights[idx], BAR_AREA_H) 
                  : hTarget;

                return (
                  <div key={idx} style={{ flex: 1, minWidth: 6, position: 'relative' }}>
                    {hoverIdx === idx && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: h + 10,
                          transform: 'translateX(-50%)',
                          background: 'rgba(17,24,39,0.92)',
                          backdropFilter: 'saturate(140%) blur(6px)',
                          color: '#fff',
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          pointerEvents: 'none'
                        }}
                      >
                        {moneyNoCents(total)}
                        <div
                          style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: -4,
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: 8,
                            height: 8,
                            background: 'rgba(17,24,39,0.92)',
                            borderLeft: '1px solid rgba(255,255,255,0.15)',
                            borderTop: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}
                        />
                      </div>
                    )}

                    <div
                      title={money(total)}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      style={{
                        height: h,
                        backgroundImage: `linear-gradient(180deg, #bfdbfe, #93c5fd)`,
                        borderRadius: 8,
                        boxShadow: hoverIdx === idx ? '0 6px 14px rgba(0,0,0,0.07)' : '0 1px 0 rgba(0,0,0,0.02)',
                        transform: hoverIdx === idx ? 'translateY(-2px)' : 'translateY(0)',
                        transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
                        willChange: 'height, transform',
                        cursor: 'default'
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Meses arriba */}
            {plot.monthSpans?.length > 0 && (
              <div style={{ 
                position: 'absolute', 
                left: 78, 
                right: 8, 
                top: BAR_AREA_H + 12 + 8, 
                height: 24 
              }}>
                {plot.monthSpans.map((s, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${s.leftPct}%`, width: `${s.widthPct}%`,
                    textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#374151',
                    letterSpacing: 0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {/* Etiquetas X */}
            <div style={{ 
              position: 'absolute',
              left: 78,
              right: 8,
              top: BAR_AREA_H + 12 + (plot.monthSpans?.length > 0 ? 32 : 8),
              display: 'flex', 
              gap: 6, 
              alignItems: 'start'
            }}>
              {plot.bars.map((b, idx) => {
                const txt = is12m
                  ? (b?.xLabel || (b?.dateRef ? fmtMonthShort.format(b.dateRef) : ''))
                  : (plot.type === 'daily' && b?.dateRef ? (
                      periodKey === '7d' ? fmtWeekdayShort.format(b.dateRef).replace('.', '') :
                      periodKey === '15d' ? String(b.dateRef.getDate()) :
                      (() => { const d = b.dateRef.getDate(); return ( (d - 1) % 3 === 0 ? String(d) : '' ); })()
                    ) : '');
                return (
                  <div key={idx} style={{ flex: 1, minWidth: 6 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: '14px', minHeight: 14, userSelect: 'none' }}>
                      {txt}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}