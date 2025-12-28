// frontend/src/components/PeakHoursHeatmap.jsx
import React, { useMemo } from 'react';
import { Box, Typography, Card, Tooltip, Grid } from '@mui/material';
import { MARANA_COLORS } from '../theme';

/**
 * Heatmap de horas pico - Muestra la distribución de pedidos por hora del día
 */
export default function PeakHoursHeatmap({ orders = [] }) {
  // Calcular pedidos por hora para todas las 24 horas
  const allHours = useMemo(() => {
    const hourCounts = new Map();
    
    // Contar pedidos por hora
    if (Array.isArray(orders) && orders.length > 0) {
      orders.forEach(order => {
        if (!order.createdAt) return;
        try {
          const date = new Date(order.createdAt);
          const hour = date.getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        } catch (error) {
          console.warn('Error parsing order date:', order.createdAt, error);
        }
      });
    }

    // Crear array con todas las 24 horas
    const hours = [];
    const totalOrders = orders.length || 1; // Evitar división por cero
    
    for (let i = 0; i < 24; i++) {
      const count = hourCounts.get(i) || 0;
      hours.push({
        hour: i,
        count,
        percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100 * 10) / 10 : 0
      });
    }
    
    return hours;
  }, [orders]);

  // Calcular top 3 horas para mostrar en la leyenda
  const top3Hours = useMemo(() => {
    return [...allHours]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => `${String(h.hour).padStart(2, '0')}hs`);
  }, [allHours]);

  const maxCount = useMemo(() => {
    const counts = allHours.map(h => h.count);
    return counts.length > 0 ? Math.max(...counts, 1) : 1;
  }, [allHours]);

  /**
   * Genera color basado en temperatura del heatmap
   * Gradiente continuo: Celeste claro (frío) → Celeste más oscuro → Amarillo → Naranja → Rojo (caliente)
   * @param {number} count - Cantidad de pedidos en esa hora
   * @returns {string} Color en formato hex
   */
  const getColor = (count) => {
    if (count === 0) return '#F5F5F5'; // Gris muy claro para sin actividad
    
    // Normalizar el ratio (0 a 1)
    const ratio = Math.min(1, count / maxCount);
    
    // Paleta de colores tipo heatmap (temperatura)
    // De frío (celeste oscuro) a caliente (rojo oscuro)
    // Celestes ocupan ~30% de la escala (0.0 a 0.3)
    // Amarillo, naranja y rojo ocupan ~70% (0.3 a 1.0)
    const colorStops = [
      { ratio: 0.0, color: { r: 103, g: 194, b: 230 } },  // Celeste oscuro (muy frío)
      { ratio: 0.15, color: { r: 56, g: 189, b: 248 } },  // Celeste medio-oscuro
      { ratio: 0.3, color: { r: 14, g: 165, b: 233 } },  // Celeste más oscuro (fin de celestes)
      { ratio: 0.5, color: { r: 234, g: 179, b: 8 } },    // Amarillo
      { ratio: 0.7, color: { r: 249, g: 115, b: 22 } },  // Naranja
      { ratio: 0.85, color: { r: 239, g: 68, b: 68 } },  // Rojo
      { ratio: 1.0, color: { r: 185, g: 28, b: 28 } }    // Rojo oscuro (muy caliente)
    ];
    
    // Encontrar los dos puntos de color entre los que estamos
    let lowerStop = colorStops[0];
    let upperStop = colorStops[colorStops.length - 1];
    
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (ratio >= colorStops[i].ratio && ratio <= colorStops[i + 1].ratio) {
        lowerStop = colorStops[i];
        upperStop = colorStops[i + 1];
        break;
      }
    }
    
    // Interpolar entre los dos colores
    const range = upperStop.ratio - lowerStop.ratio;
    const t = range > 0 ? (ratio - lowerStop.ratio) / range : 0;
    
    const r = Math.round(lowerStop.color.r + (upperStop.color.r - lowerStop.color.r) * t);
    const g = Math.round(lowerStop.color.g + (upperStop.color.g - lowerStop.color.g) * t);
    const b = Math.round(lowerStop.color.b + (upperStop.color.b - lowerStop.color.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
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
            const bgColor = getColor(hourData.count);
            const intensity = hourData.count > 0 ? Math.min(1, hourData.count / maxCount) : 0;

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
                      border: `1px solid ${MARANA_COLORS.border}40`,
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
                        fontWeight: intensity > 0 ? 700 : 500,
                        color: intensity === 0 ? MARANA_COLORS.textSecondary : '#ffffff',
                        textAlign: 'center',
                        textShadow: intensity > 0 ? '0px 1px 2px rgba(0,0,0,0.3)' : 'none'
                      }}
                    >
                      {hourData.hour}
                    </Typography>
                    {top3Hours.includes(formatHour(hourData.hour)) && (
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
              background: 'linear-gradient(to right, rgb(103, 194, 230) 0%, rgb(56, 189, 248) 15%, rgb(14, 165, 233) 30%, rgb(234, 179, 8) 50%, rgb(249, 115, 22) 70%, rgb(239, 68, 68) 85%, rgb(185, 28, 28) 100%)',
              mx: 1
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600 }}>
            Alta interacción
          </Typography>
        </Box>
        {top3Hours.length > 0 && (
          <Box sx={{ ml: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600 }}>
              Top 3: {top3Hours.join(', ')}
            </Typography>
          </Box>
        )}
      </Box>
    </Card>
  );
}

