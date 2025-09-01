// src/components/KpiSummary.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Grid } from "@mui/material";
import KpiCard from "./KpiCard";
import { getPaidOrders } from "../api/analytics";

// Format helpers
const money = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n || 0);

const isSameUTCDate = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
};

export default function KpiSummary({ slug, dateFrom, dateTo }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trae pedidos “paid” en el rango
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const list = await getPaidOrders({ slug, from: dateFrom, to: dateTo });
        if (mounted) setOrders(list);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const totalPeriodo = orders.reduce((s, o) => s + (o.total || 0), 0);
    const pedidos = orders.length;
    const ticketProm = pedidos ? totalPeriodo / pedidos : 0;

    const hoy = new Date();
    const ingresosHoy = orders
      .filter((o) => isSameUTCDate(o.createdAt, hoy))
      .reduce((s, o) => s + (o.total || 0), 0);

    return {
      ingresosHoy,
      pedidos,
      ticketProm,
      clientes: pedidos, // por ahora clientes = pedidos
      totalPeriodo,
    };
  }, [orders]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <KpiCard
          title="Ingresos del Día"
          value={loading ? "…" : money(kpis.ingresosHoy)}
          subtitle={loading ? "" : ""}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <KpiCard
          title="Pedidos Completados"
          value={loading ? "…" : kpis.pedidos}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <KpiCard
          title="Ticket Promedio"
          value={loading ? "…" : money(kpis.ticketProm)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <KpiCard
          title="Clientes Atendidos"
          value={loading ? "…" : kpis.clientes}
        />
      </Grid>
    </Grid>
  );
}
