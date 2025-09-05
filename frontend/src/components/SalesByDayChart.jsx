// src/components/SalesByDayChart.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesByDay } from '../api/analytics';

// ===== Formateo de dinero
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

// ===== Helpers de fecha (LOCAL, no UTC)
const toLocalDate = (ymd /* 'YYYY-MM-DD' */) => new Date(`${ymd}T00:00:00`);
const weekdayShort = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });
const monthAbbr = (d) => new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(d);

export default function SalesByDayChart({
  slug,
  start,
  end,
  title = 'Ventas por día',
  onTotalChange,
  periodKey = '30d',
}) {
  // Carga dinámica de chart.js/react-chartjs-2 para evitar 500 si faltan deps
  const [BarComp, setBarComp] = useState(null);        // componente Bar real
  const [chartReady, setChartReady] = useState(false); // true si pudieron importarse
  const [chartError, setChartError] = useState(null);  // mensaje si faltan deps

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Import dinámico (no rompe el bundle si no está instalado)
        await import('chart.js/auto');
        const mod = await import('react-chartjs-2');
        if (!alive) return;
        setBarComp(() => mod.Bar);
        setChartReady(true);
        setChartError(null);
      } catch (e) {
        if (!alive) return;
        setChartReady(false);
        setChartError(
          'Faltan dependencias del gráfico (chart.js/react-chartjs-2). ' +
          'Instalá: npm i chart.js@^4 react-chartjs-2@^5'
        );
      }
    })();
    return () => { alive = false; };
  }, []);

  const [series, setSeries] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const HEIGHT = 300;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { series, grandTotal } = await fetchSalesByDay(slug, { start, end });
        if (!alive) return;
        setSeries(series);
        setGrandTotal(grandTotal);
        onTotalChange?.(grandTotal);
        setErr(null);
      } catch {
        if (!alive) return;
        setErr('No se pudieron cargar las ventas');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug, start, end, onTotalChange]);

  // ===== Preparación de labels/values según período
  const { labels, values, sixMonthPlacements } = useMemo(() => {
    let labels = [];
    let values = [];
    let sixMonthPlacements = []; // [{centerIndex, monthDate}]

    if (periodKey === '1y') {
      const byMonth = new Map(); // 'YYYY-MM' -> total
      for (const r of series) {
        const d = toLocalDate(r.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, (byMonth.get(key) || 0) + Number(r.total || 0));
      }
      const endRef = end instanceof Date
        ? end
        : (series.length ? toLocalDate(series[series.length - 1].date) : new Date());
      const endMonthLocal = new Date(endRef.getFullYear(), endRef.getMonth(), 1);
      const months = [];
      for (let i = 11; i >= 0; i--) {
        months.push(new Date(endMonthLocal.getFullYear(), endMonthLocal.getMonth() - i, 1));
      }
      labels = months.map((d) => monthAbbr(d).toUpperCase());
      values = months.map((d) => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return byMonth.get(key) || 0;
      });
    } else if (periodKey === '7d') {
      const s = series.slice(-7);
      labels = s.map((r) => weekdayShort.format(toLocalDate(r.date)).replace('.', ''));
      values = s.map((r) => r.total);
    } else if (periodKey === '15d' || periodKey === '30d') {
      labels = series.map((r) => String(toLocalDate(r.date).getDate()));
      values = series.map((r) => r.total);
    } else if (periodKey === '6m') {
      const byHalf = new Map(); // 'YYYY-MM' -> { h1, h2, mm, yy }
      for (const r of series) {
        const d = toLocalDate(r.date);
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const mid = Math.ceil(daysInMonth / 2);
        const isH1 = d.getDate() <= mid;
        const prev = byHalf.get(key) || { h1: 0, h2: 0, mm: m, yy: y };
        if (isH1) prev.h1 += Number(r.total || 0); else prev.h2 += Number(r.total || 0);
        byHalf.set(key, prev);
      }
      const monthsSorted = [...byHalf.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1));

      const bars = []; // [{value, monthKey, monthDate}]
      monthsSorted.forEach(([key, obj]) => {
        const monthDate = new Date(obj.yy, obj.mm, 1);
        bars.push({ value: obj.h1, monthKey: key, monthDate });
        bars.push({ value: obj.h2, monthKey: key, monthDate });
      });
      while (bars.length && bars[bars.length - 1].value === 0) bars.pop();

      labels = bars.map(() => '');
      values = bars.map((b) => b.value);

      // Centros para el rótulo del mes
      const monthToIdx = new Map();
      bars.forEach((b, idx) => {
        const arr = monthToIdx.get(b.monthKey) || [];
        arr.push(idx);
        monthToIdx.set(b.monthKey, arr);
      });
      sixMonthPlacements = monthsSorted
        .filter(([k]) => monthToIdx.has(k))
        .map(([k, obj]) => {
          const idxs = monthToIdx.get(k);
          const center = idxs.length === 2 ? (idxs[0] + idxs[1]) / 2 : idxs[0];
          return { centerIndex: center, monthDate: new Date(obj.yy, obj.mm, 1) };
        });
    } else {
      labels = series.map((r) => r.date);
      values = series.map((r) => r.total);
    }

    return { labels, values, sixMonthPlacements };
  }, [series, periodKey, end]);

  const data = useMemo(() => ({
    labels,
    datasets: [{ label: 'Total (ARS)', data: values }],
  }), [labels, values]);

  // ===== Plugins para rótulos de meses
  const monthBanner15_30 = {
    id: 'monthBanner15_30',
    afterDraw(chart) {
      if (!(periodKey === '15d' || periodKey === '30d')) return;
      if (!series.length) return;
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const y = area.bottom + 40;

      ctx.save();
      ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';

      const blocks = [];
      let blockStart = 0;
      let cur = toLocalDate(series[0].date);
      for (let i = 1; i < series.length; i++) {
        const d = toLocalDate(series[i].date);
        if (d.getMonth() !== cur.getMonth() || d.getFullYear() !== cur.getFullYear()) {
          blocks.push({ start: blockStart, end: i - 1, date: cur });
          blockStart = i; cur = d;
        }
      }
      blocks.push({ start: blockStart, end: series.length - 1, date: cur });

      for (const b of blocks) {
        const mid = (b.start + b.end) / 2;
        const x = xScale.getPixelForValue(mid);
        ctx.fillText(`${monthAbbr(b.date).toUpperCase()} ${b.date.getFullYear()}`, x, y);
      }
      ctx.restore();
    },
  };

  const monthCenter6m = {
    id: 'monthCenter6m',
    afterDraw(chart) {
      if (periodKey !== '6m') return;
      if (!sixMonthPlacements.length) return;
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const y = area.bottom + 28;

      ctx.save();
      ctx.font = '600 11px system-ui, -apple-system, Segoe UI, Roboto';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      sixMonthPlacements.forEach(({ centerIndex, monthDate }) => {
        ctx.fillText(monthAbbr(monthDate).toUpperCase(), xScale.getPixelForValue(centerIndex), y);
      });
      ctx.restore();
    },
  };

  // ===== Opciones
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300, easing: 'easeOutQuart' },
    responsiveAnimationDuration: 0,
    layout: {
      padding: {
        bottom:
          periodKey === '6m' ? 30 :
          (periodKey === '15d' || periodKey === '30d') ? 36 : 8,
      },
    },
    plugins: {
      title: { display: false, text: title },
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${money(ctx.parsed.y)}` } },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          count: 5,
          maxTicksLimit: 5,
          callback: (v) => money(v),
        },
      },
      x: {
        ticks: {
          autoSkip: periodKey === '6m' ? false : undefined,
          maxRotation: 0,
          minRotation: 0,
          callback: function (value, index) {
            if (periodKey === '30d' && series[index]) {
              const d = toLocalDate(series[index].date).getDate();
              return ((d - 1) % 3 === 0) ? String(d) : '';
            }
            return this.getLabelForValue(index);
          },
        },
      },
    },
  }), [periodKey, series, title]);

  const overlayMessage = loading
    ? 'Cargando ventas…'
    : err || (!series.length && 'No hay ventas en el período seleccionado.');

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        Total del período: {money(grandTotal)}
      </div>

      <div style={{ height: HEIGHT, position: 'relative' }}>
        {/* Si faltan deps, placeholder amigable sin romper la app */}
        {!chartReady && chartError && (
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#fff', color: '#b91c1c', padding: 12, textAlign: 'center'
            }}
          >
            {chartError}
          </div>
        )}

        {chartReady && BarComp ? (
          <BarComp data={data} options={options}
                   plugins={[
                     ...(periodKey === '15d' || periodKey === '30d' ? [monthBanner15_30] : []),
                     ...(periodKey === '6m' ? [monthCenter6m] : []),
                   ]} />
        ) : null}

        {overlayMessage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: loading ? 'rgba(255,255,255,0.6)' : '#fff',
              color: err ? 'crimson' : undefined,
            }}
          >
            {overlayMessage}
          </div>
        )}
      </div>
    </div>
  );
}
