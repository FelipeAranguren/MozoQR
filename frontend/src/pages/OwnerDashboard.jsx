// OwnerDashboard.jsx (ejemplo mínimo)
import React from 'react';
import SalesByDayChart from '../components/SalesByDayChart';

export default function OwnerDashboard() {
  const slug = 'mcdonalds';
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return (
    <div style={{ padding: 24 }}>
      <h2>Dashboard del dueño</h2>
      <SalesByDayChart slug={slug} start={start} end={end} />
      {/* acá podés sumar más tarjetas/métricas */}
    </div>
  );
}
