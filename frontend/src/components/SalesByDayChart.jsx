// src/components/SalesByDayChart.jsx
import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { fetchSalesByDay } from '../api/analytics';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(Number(n) || 0);

/**
 * Props:
 *  - slug (string, requerido)
 *  - start, end (Date o 'YYYY-MM-DD', opcional)
 *  - title (string, opcional)
 */
export default function SalesByDayChart({ slug, start, end, title = 'Ventas por día' }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await fetchSalesByDay(slug, { start, end });
        if (!alive) return;
        setSeries(rows);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setErr('No se pudieron cargar las ventas');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug, start, end]);

  if (loading) return <div>Cargando ventas…</div>;
  if (err) return <div style={{ color: 'crimson' }}>{err}</div>;
  if (!series.length) return <div>No hay ventas en el período seleccionado.</div>;

  const labels = series.map((r) => r.date);
  const values = series.map((r) => r.total);

  const data = {
    labels,
    datasets: [
      {
        label: 'Total (ARS)',
        data: values,
        // sin colores explícitos, Chart.js asigna uno por defecto
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      title: { display: true, text: title },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${money(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v) => money(v),
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
