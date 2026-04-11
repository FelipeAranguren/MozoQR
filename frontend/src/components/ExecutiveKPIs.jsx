// src/components/ExecutiveKPIs.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { MARANA_COLORS } from '../theme';

// Componente que ajusta automáticamente el tamaño de fuente
function AutoSizeText({ children, maxFontSize = '1.8rem', minFontSize = '0.9rem', color }) {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const adjustFontSize = () => {
      if (!textRef.current || !containerRef.current) return;
      
      const container = containerRef.current;
      const text = textRef.current;
      const containerWidth = container.offsetWidth;
      const maxWidth = containerWidth * 0.95; // 95% del ancho disponible
      
      // Resetear al tamaño máximo
      text.style.fontSize = maxFontSize;
      
      // Reducir hasta que quepa
      while (text.scrollWidth > maxWidth && parseFloat(text.style.fontSize) > parseFloat(minFontSize)) {
        const currentSize = parseFloat(text.style.fontSize);
        text.style.fontSize = `${currentSize - 0.1}rem`;
      }
      
      setFontSize(text.style.fontSize);
    };

    adjustFontSize();
    window.addEventListener('resize', adjustFontSize);
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [children, maxFontSize, minFontSize]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <Typography
        ref={textRef}
        component="div"
        sx={{
          fontWeight: 800,
          color: color,
          lineHeight: 1,
          fontSize: fontSize,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          maxWidth: '100%'
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

/**
 * Componente de KPIs Ejecutivos - Cards grandes con métricas estratégicas
 */
export default function ExecutiveKPIs({
  periodTotal,
  ticketPromedio,
  sessionsCount,
  lifetimeOrders,
  todayVsYesterday,
  weeklyComparison,
  salesTrend,
  loading = false
}) {
  // Calcular ocupación estimada (sesiones / días del período)
  const ocupacionEstimada = sessionsCount > 0 ? Math.min(100, Math.round((sessionsCount / 30) * 10)) : 0;

  // Calcular rentabilidad estimada (simplificado: ingresos - estimación de costos)
  // En producción esto vendría de datos reales de costos
  const rentabilidadEstimada = periodTotal * 0.3; // Estimación del 30% de margen

  const kpis = [
    {
      title: 'Ingresos Totales',
      value: periodTotal,
      formatter: money,
      icon: <AttachMoneyIcon sx={{ fontSize: 40 }} />,
      color: MARANA_COLORS.primary,
      subtitle: 'Período seleccionado',
      trend: todayVsYesterday && Math.abs(todayVsYesterday.percentChange) > 0.1 ? {
        value: Math.round(todayVsYesterday.percentChange * 10) / 10,
        label: 'vs ayer'
      } : undefined
    },
    {
      title: 'Rentabilidad Estimada',
      value: rentabilidadEstimada,
      formatter: money,
      icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
      color: '#10b981',
      subtitle: 'Margen estimado ~30%',
      trend: salesTrend ? {
        value: Math.round(salesTrend.percentChange * 10) / 10,
        label: 'tendencia'
      } : undefined
    },
    {
      title: 'Ticket Promedio',
      value: ticketPromedio,
      formatter: money,
      icon: <RestaurantIcon sx={{ fontSize: 40 }} />,
      color: MARANA_COLORS.secondary,
      subtitle: 'Por transacción',
      trend: weeklyComparison ? {
        value: weeklyComparison.lastWeek > 0 
          ? Math.round(((weeklyComparison.thisWeek / weeklyComparison.lastWeek) - 1) * 100 * 10) / 10
          : 0,
        label: 'vs semana pasada'
      } : undefined
    },
    {
      title: 'Ocupación',
      value: ocupacionEstimada,
      formatter: (n) => `${Math.round(n)}%`,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: MARANA_COLORS.accent,
      subtitle: `${sessionsCount} clientes atendidos`,
      trend: undefined
    }
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {kpis.map((kpi, index) => (
        <Grid item xs={12} sm={6} lg={3} key={index}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `2px solid ${kpi.color}20`,
              background: `linear-gradient(135deg, ${kpi.color}08 0%, #ffffff 100%)`,
              transition: 'all 0.3s ease',
              height: '100%',
              transform: 'scale(0.85)',
              transformOrigin: 'center',
              '&:hover': {
                transform: 'scale(0.87) translateY(-2px)',
                boxShadow: `0px 12px 32px ${kpi.color}25`,
                borderColor: `${kpi.color}40`,
              }
            }}
          >
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: `${kpi.color}15`,
                    color: kpi.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {React.cloneElement(kpi.icon, { sx: { fontSize: 32 } })}
                </Box>
              </Box>

              <Typography
                variant="caption"
                sx={{
                  color: MARANA_COLORS.textSecondary,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  fontSize: '10px',
                  display: 'block',
                  mb: 1
                }}
              >
                {kpi.title}
              </Typography>

              <Box
                sx={{
                  width: '100%',
                  mb: 0.5,
                  minHeight: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {loading ? (
                  <Typography
                    sx={{
                      fontWeight: 800,
                      color: kpi.color,
                      fontSize: '1.5rem'
                    }}
                  >
                    ...
                  </Typography>
                ) : (
                  <AutoSizeText
                    maxFontSize="1.8rem"
                    minFontSize="0.9rem"
                    color={kpi.color}
                  >
                    {kpi.formatter(kpi.value)}
                  </AutoSizeText>
                )}
              </Box>

              {kpi.subtitle && (
                <Typography
                  variant="body2"
                  sx={{
                    color: MARANA_COLORS.textSecondary,
                    fontSize: '11px',
                    mb: kpi.trend ? 0.5 : 0,
                    textAlign: 'center'
                  }}
                >
                  {kpi.subtitle}
                </Typography>
              )}

              {kpi.trend && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    mt: 1,
                    pt: 1,
                    borderTop: `1px solid ${MARANA_COLORS.border}30`
                  }}
                >
                  <TrendingUpIcon 
                    sx={{ 
                      fontSize: 14, 
                      color: kpi.trend.value > 0 ? '#10b981' : '#ef4444' 
                    }} 
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: kpi.trend.value > 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700,
                      fontSize: '11px'
                    }}
                  >
                    {kpi.trend.value > 0 ? '+' : ''}{kpi.trend.value}% {kpi.trend.label}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

