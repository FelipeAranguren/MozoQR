// frontend/src/components/PeakHoursHeatmap.jsx
import React, { useMemo } from 'react';
import { Box, Typography, Card, Tooltip, Grid } from '@mui/material';
import { MARANA_COLORS } from '../theme';
import { calculatePeakHours } from '../utils/dashboardMetrics';

/**
 * Heatmap de horas pico - Muestra las horas con más actividad
 */
export default function PeakHoursHeatmap({ orders = [] }) {
  const peakHours = useMemo(() => {
    try {
      if (!Array.isArray(orders) || orders.length === 0) {
        return [];
      }
      return calculatePeakHours(orders);
    } catch (error) {
      console.error('Error calculating peak hours:', error);
      return [];
    }
  }, [orders]);

  // Crear mapa de todas las horas del día
  const allHours = useMemo(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      // peakHours tiene formato { hour: "14:00", count: X, percentage: Y }
      const peakData = peakHours.find(p => {
        const hourStr = String(p.hour || '');
        const hourNum = parseInt(hourStr.split(':')[0]);
        return hourNum === i;
      });
      hours.push({
        hour: i,
        count: peakData?.count || 0,
        percentage: peakData?.percentage || 0,
        isPeak: peakData !== undefined
      });
    }
    return hours;
  }, [peakHours]);

  const maxCount = useMemo(() => {
    const counts = allHours.map(h => h.count);
    return counts.length > 0 ? Math.max(...counts, 1) : 1;
  }, [allHours]);

  const getIntensity = (count) => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 4; // Muy alta
    if (ratio >= 0.6) return 3; // Alta
    if (ratio >= 0.4) return 2; // Media
    if (ratio >= 0.2) return 1; // Baja
    return 0.5; // Muy baja
  };

  /**
   * Genera color del gradiente: Azul (baja) → Verde → Amarillo → Naranja → Rojo (alta)
   * @param {number} intensity - Nivel de intensidad (0-4)
   * @returns {string} Color en formato hex
   */
  const getColor = (intensity) => {
    if (intensity === 0) return '#E7E7E7'; // Gris para sin actividad
    
    // Gradiente de colores basado en intensidad
    // 0.5 (muy baja) → Azul
    // 1 (baja) → Verde azulado
    // 2 (media) → Verde
    // 3 (alta) → Amarillo/Naranja
    // 4 (muy alta) → Rojo
    
    const colors = {
      0.5: '#3B82F6',  // Azul (baja interacción)
      1: '#10B981',    // Verde (baja-media)
      2: '#84CC16',    // Verde amarillento (media)
      3: '#F59E0B',    // Naranja (alta)
      4: '#EF4444'     // Rojo (alta interacción)
    };
    
    // Interpolación suave entre niveles
    if (intensity <= 0.5) return colors[0.5];
    if (intensity <= 1) {
      const t = (intensity - 0.5) / 0.5;
      return interpolateColor(colors[0.5], colors[1], t);
    }
    if (intensity <= 2) {
      const t = (intensity - 1) / 1;
      return interpolateColor(colors[1], colors[2], t);
    }
    if (intensity <= 3) {
      const t = (intensity - 2) / 1;
      return interpolateColor(colors[2], colors[3], t);
    }
    if (intensity <= 4) {
      const t = (intensity - 3) / 1;
      return interpolateColor(colors[3], colors[4], t);
    }
    return colors[4];
  };

  /**
   * Interpola entre dos colores hex
   */
  const interpolateColor = (color1, color2, t) => {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  };

  const formatHour = (hour) => {
    return `${String(hour).padStart(2, '0')}:00`;
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        p: 3
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Horas Pico
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Distribución de pedidos por hora del día
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Grid container spacing={1}>
          {allHours.map((hourData) => {
            const intensity = getIntensity(hourData.count);
            const bgColor = getColor(intensity);
            const isPeak = hourData.isPeak;

            return (
              <Grid item xs={3} sm={2} md={1.5} key={hourData.hour}>
                <Tooltip
                  title={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatHour(hourData.hour)}
                      </Typography>
                      <Typography variant="caption">
                        {hourData.count} pedido{hourData.count !== 1 ? 's' : ''}
                      </Typography>
                      {hourData.percentage > 0 && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          {hourData.percentage}% del total
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 1.5,
                      bgcolor: bgColor,
                      border: isPeak ? `2px solid ${MARANA_COLORS.primary}` : `1px solid ${MARANA_COLORS.border}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: `0px 4px 12px ${MARANA_COLORS.primary}30`,
                        zIndex: 1
                      }
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '10px',
                        fontWeight: isPeak ? 700 : 500,
                        color: intensity === 0 ? MARANA_COLORS.textSecondary : '#ffffff',
                        textAlign: 'center',
                        textShadow: intensity > 0 ? '0px 1px 2px rgba(0,0,0,0.3)' : 'none'
                      }}
                    >
                      {hourData.hour}
                    </Typography>
                    {isPeak && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: MARANA_COLORS.secondary,
                          border: `2px solid #ffffff`
                        }}
                      />
                    )}
                  </Box>
                </Tooltip>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Leyenda */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: `1px solid ${MARANA_COLORS.border}40` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600 }}>
            Baja interacción
          </Typography>
          <Box 
            sx={{ 
              flex: 1,
              height: 8,
              borderRadius: 1,
              background: 'linear-gradient(to right, #3B82F6 0%, #10B981 25%, #84CC16 50%, #F59E0B 75%, #EF4444 100%)',
              mx: 1
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600 }}>
            Alta interacción
          </Typography>
        </Box>
        {peakHours.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600 }}>
              Top 3: {peakHours.slice(0, 3).map(p => p.hour).join(', ')}
            </Typography>
          </Box>
        )}
      </Box>
    </Card>
  );
}

