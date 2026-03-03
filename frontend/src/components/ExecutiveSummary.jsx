// src/components/ExecutiveSummary.jsx
import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Divider } from '@mui/material';
import { MARANA_COLORS } from '../theme';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

/**
 * Componente de Resumen Ejecutivo - Resúmenes consolidados de alto nivel
 */
export default function ExecutiveSummary({
  periodTotal,
  ticketPromedio,
  sessionsCount,
  lifetimeOrders,
  invoices,
  periodOrders,
  todayVsYesterday,
  weeklyComparison
}) {
  // Calcular métricas adicionales
  const totalFacturas = invoices.length;
  const promedioPorFactura = totalFacturas > 0 ? periodTotal / totalFacturas : 0;
  const promedioItemsPorFactura = totalFacturas > 0 
    ? invoices.reduce((sum, inv) => sum + (inv.items || 0), 0) / totalFacturas 
    : 0;

  // Calcular crecimiento
  const crecimientoDiario = todayVsYesterday?.yesterday > 0
    ? ((todayVsYesterday.today - todayVsYesterday.yesterday) / todayVsYesterday.yesterday) * 100
    : 0;

  const crecimientoSemanal = weeklyComparison?.lastWeek > 0
    ? ((weeklyComparison.thisWeek - weeklyComparison.lastWeek) / weeklyComparison.lastWeek) * 100
    : 0;

  const summaryItems = [
    {
      label: 'Total de Facturas',
      value: totalFacturas,
      formatter: (n) => Math.round(n).toLocaleString('es-AR'),
      unit: 'facturas'
    },
    {
      label: 'Promedio por Factura',
      value: promedioPorFactura,
      formatter: money,
      unit: ''
    },
    {
      label: 'Items por Factura',
      value: promedioItemsPorFactura,
      formatter: (n) => Math.round(n * 10) / 10,
      unit: 'items'
    },
    {
      label: 'Crecimiento Diario',
      value: crecimientoDiario,
      formatter: (n) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}%`,
      unit: '',
      color: crecimientoDiario > 0 ? '#10b981' : crecimientoDiario < 0 ? '#ef4444' : MARANA_COLORS.textSecondary
    },
    {
      label: 'Crecimiento Semanal',
      value: crecimientoSemanal,
      formatter: (n) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}%`,
      unit: '',
      color: crecimientoSemanal > 0 ? '#10b981' : crecimientoSemanal < 0 ? '#ef4444' : MARANA_COLORS.textSecondary
    },
    {
      label: 'Pedidos Históricos',
      value: lifetimeOrders,
      formatter: (n) => Math.round(n).toLocaleString('es-AR'),
      unit: 'pedidos'
    }
  ];

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: '#fff',
        mb: 4
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          Resumen Ejecutivo
        </Typography>
        <Grid container spacing={3}>
          {summaryItems.map((item, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: MARANA_COLORS.textSecondary,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontSize: '11px',
                    display: 'block',
                    mb: 1
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: item.color || MARANA_COLORS.textPrimary,
                    lineHeight: 1.2
                  }}
                >
                  {item.formatter(item.value)}
                  {item.unit && (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{
                        color: MARANA_COLORS.textSecondary,
                        fontWeight: 400,
                        ml: 0.5,
                        fontSize: '0.875rem'
                      }}
                    >
                      {item.unit}
                    </Typography>
                  )}
                </Typography>
              </Box>
              {index < summaryItems.length - 1 && index % 3 !== 2 && (
                <Divider orientation="vertical" flexItem sx={{ position: 'absolute', right: 0, height: '60%', top: '20%' }} />
              )}
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

