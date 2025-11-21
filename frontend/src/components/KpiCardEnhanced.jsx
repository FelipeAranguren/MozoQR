// frontend/src/components/KpiCardEnhanced.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, Typography, Box, Tooltip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { MARANA_COLORS } from '../theme';

/**
 * KPI Card mejorado con animaciones y comparativas
 */
export default function KpiCardEnhanced({
  title,
  value,
  formatter = (v) => v,
  subtitle,
  trend,              // { value: number, label: string } - comparativa
  icon,
  color = MARANA_COLORS.primary,
  loading = false
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = useMemo(() => {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    return isNaN(num) ? 0 : num;
  }, [value]);

  // Animación counter-up
  useEffect(() => {
    if (loading) return;
    
    const duration = 900;
    const start = performance.now();
    const startValue = displayValue;
    const endValue = numericValue;
    
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      
      // Easing easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };
    
    requestAnimationFrame(animate);
  }, [numericValue, loading]);

  const trendColor = trend?.value > 0 ? MARANA_COLORS.primary : trend?.value < 0 ? MARANA_COLORS.accent : MARANA_COLORS.textSecondary;
  const TrendIcon = trend?.value > 0 ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0px 8px 24px ${color}15`,
          borderColor: `${color}40`,
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: MARANA_COLORS.textSecondary,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontSize: '11px'
            }}
          >
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                p: 0.75,
                borderRadius: 2,
                bgcolor: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {icon}
            </Box>
          )}
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: MARANA_COLORS.textPrimary,
            mb: trend ? 0.5 : 0,
            lineHeight: 1.1,
            minHeight: 40,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {loading ? '...' : formatter(displayValue)}
        </Typography>

        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: MARANA_COLORS.textSecondary,
              fontSize: '12px',
              display: 'block',
              mt: 0.5
            }}
          >
            {subtitle}
          </Typography>
        )}

        {trend && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 1,
              pt: 1,
              borderTop: `1px solid ${MARANA_COLORS.border}40`
            }}
          >
            <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
            <Typography
              variant="caption"
              sx={{
                color: trendColor,
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}