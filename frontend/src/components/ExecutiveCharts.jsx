// src/components/ExecutiveCharts.jsx
import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import SalesByDayChart from './SalesByDayChart';
import TopProductsChart from './TopProductsChart';
import PeakHoursHeatmap from './PeakHoursHeatmap';
import ComparisonCard from './ComparisonCard';
import { MARANA_COLORS } from '../theme';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

/**
 * Componente de Gráficos Ejecutivos - Gráficos consolidados para análisis estratégico
 */
export default function ExecutiveCharts({
  slug,
  start,
  end,
  periodKey,
  periodTotal,
  onTotalChange,
  topProducts,
  periodOrders,
  todayVsYesterday,
  weeklyComparison,
  salesTrend
}) {
  return (
    <>
      {/* Gráfico principal de ventas */}
      <Box sx={{ mb: 4 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 4,
            border: `1px solid ${MARANA_COLORS.border}`,
            background: '#fff',
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 3, borderBottom: `1px solid ${MARANA_COLORS.border}` }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                Tendencias de Ventas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Evolución de ingresos en el período seleccionado
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <SalesByDayChart
                slug={slug}
                start={start}
                end={end}
                periodKey={periodKey}
                onTotalChange={onTotalChange}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Comparativas estratégicas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <ComparisonCard
            title="HOY vs AYER"
            currentValue={todayVsYesterday?.today || 0}
            previousValue={todayVsYesterday?.yesterday || 0}
            formatter={money}
            currentLabel="Hoy"
            previousLabel="Ayer"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ComparisonCard
            title="Esta Semana vs Semana Pasada"
            currentValue={weeklyComparison?.thisWeek || 0}
            previousValue={weeklyComparison?.lastWeek || 0}
            formatter={money}
            currentLabel="Esta semana"
            previousLabel="Semana pasada"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ComparisonCard
            title="Tendencia 7 días"
            currentValue={salesTrend?.recent || 0}
            previousValue={salesTrend?.previous || 0}
            formatter={money}
            currentLabel="Últimos 7 días"
            previousLabel="Anteriores 7 días"
          />
        </Grid>
      </Grid>

      {/* Productos Top y Horas Pico */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 4,
              border: `1px solid ${MARANA_COLORS.border}`,
              background: '#fff',
              height: '100%'
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Productos Más Vendidos
              </Typography>
              <TopProductsChart products={topProducts} limit={10} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Horas Pico de Demanda
            </Typography>
            <PeakHoursHeatmap orders={periodOrders} />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}

