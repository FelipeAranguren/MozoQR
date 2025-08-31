// src/pages/OwnerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  CircularProgress,
  Divider,
  Chip,
  Stack,
  Tooltip,
} from "@mui/material";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import dayjs from "dayjs";
import { fetchRestaurantAnalytics } from "../api/analytics";

// --- util ---
const money = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const number = (n) => new Intl.NumberFormat("es-AR").format(n || 0);

// --- component ---
export default function OwnerDashboard() {
  // Si manejás multi-tenant por slug en la URL, podés leerlo con react-router:
  // const { slug } = useParams();
  // Para demo lo dejamos fijo. Cambiá aquí al slug de cada dueño logueado.
  const [slug] = useState("mcdonalds");

  const [range, setRange] = useState(() => ({
    from: dayjs().subtract(13, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    preset: "last14",
  }));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const presets = [
    { value: "today", label: "Hoy", from: dayjs().format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") },
    { value: "yesterday", label: "Ayer", from: dayjs().subtract(1, "day").format("YYYY-MM-DD"), to: dayjs().subtract(1, "day").format("YYYY-MM-DD") },
    { value: "last7", label: "Últimos 7 días", from: dayjs().subtract(6, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") },
    { value: "last14", label: "Últimos 14 días", from: dayjs().subtract(13, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") },
    { value: "last30", label: "Últimos 30 días", from: dayjs().subtract(29, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") },
  ];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchRestaurantAnalytics({ slug, from: range.from, to: range.to })
      .then((res) => {
        if (isMounted) setData(res);
      })
      .finally(() => isMounted && setLoading(false));
    return () => {
      isMounted = false;
    };
  }, [slug, range.from, range.to]);

  const peakHour = useMemo(() => {
    if (!data?.ordersByHour?.length) return null;
    return data.ordersByHour.reduce((max, it) => (it.orders > max.orders ? it : max), data.ordersByHour[0]);
  }, [data]);

  return (
    <Box p={2} sx={{ maxWidth: 1400, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        📊 Estadísticas del restaurante
      </Typography>

      {/* Filtros */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Rango rápido"
                fullWidth
                value={range.preset}
                onChange={(e) => {
                  const p = presets.find((x) => x.value === e.target.value);
                  setRange({ from: p.from, to: p.to, preset: p.value });
                }}
              >
                {presets.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                type="date"
                label="Desde"
                fullWidth
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value, preset: "custom" }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                type="date"
                label="Hasta"
                fullWidth
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value, preset: "custom" }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? (
        <Box display="flex" alignItems="center" justifyContent="center" minHeight={300}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* KPIs */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Ingresos" />
                <CardContent>
                  <Typography variant="h4">{money(data?.kpis?.revenue)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Período: {dayjs(range.from).format("DD/MM")} – {dayjs(range.to).format("DD/MM")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Pedidos" />
                <CardContent>
                  <Typography variant="h4">{number(data?.kpis?.orders)}</Typography>
                  <Typography variant="body2" color="text.secondary">Total de tickets</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Ticket promedio" />
                <CardContent>
                  <Typography variant="h4">{money(data?.kpis?.avgTicket)}</Typography>
                  <Typography variant="body2" color="text.secondary">Ingresos / pedidos</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box my={2} />

          {/* Series de ingresos + pedidos por hora */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Card sx={{ height: 360 }}>
                <CardHeader title="Ingresos por día" subheader="Tendencia del período seleccionado" />
                <CardContent sx={{ height: 280 }}>
                  {data?.revenueSeries?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.revenueSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format("DD/MM")} />
                        <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <RTooltip formatter={(v) => money(v)} labelFormatter={(l) => dayjs(l).format("DD/MM/YYYY")} />
                        <Line type="monotone" dataKey="revenue" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: 360 }}>
                <CardHeader
                  title="Pedidos por hora"
                  subheader={
                    peakHour ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Pico:
                        </Typography>
                        <Chip size="small" label={`${peakHour.hour}:00`} />
                        <Typography variant="body2" color="text.secondary">
                          ({number(peakHour.orders)} pedidos)
                        </Typography>
                      </Stack>
                    ) : null
                  }
                />
                <CardContent sx={{ height: 280 }}>
                  {data?.ordersByHour?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.ordersByHour}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <RTooltip />
                        <Bar dataKey="orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box my={2} />

          {/* Top productos */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: 360 }}>
                <CardHeader title="Top productos (por cantidad)" />
                <CardContent sx={{ height: 280 }}>
                  {data?.topProducts?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...data.topProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 7)}
                        layout="vertical"
                        margin={{ left: 120 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} />
                        <RTooltip />
                        <Bar dataKey="quantity" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: 360 }}>
                <CardHeader title="Participación por ingresos" />
                <CardContent sx={{ height: 280 }}>
                  {data?.topProducts?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          dataKey="revenue"
                          nameKey="name"
                          data={[...data.topProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 6)}
                          outerRadius={110}
                          label={(d) => d.name}
                        >
                          {data.topProducts.slice(0, 6).map((_, i) => (
                            <Cell key={i} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(v) => money(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box my={3} />
          <Divider />
          <Box my={2} />
          <Typography variant="caption" color="text.secondary">
            Tip: filtrá por “Hoy” para monitorear el turno en vivo, o por “Últimos 30 días” para ver tendencias.
          </Typography>
        </>
      )}
    </Box>
  );
}

function EmptyState() {
  return (
    <Box height="100%" display="flex" alignItems="center" justifyContent="center">
      <Typography color="text.secondary">Sin datos para este período</Typography>
    </Box>
  );
}
