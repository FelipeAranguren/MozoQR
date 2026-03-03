// frontend/src/components/ComparisonCard.jsx
import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import { MARANA_COLORS } from '../theme';

/**
 * Tarjeta de comparativa - Muestra comparación entre dos períodos
 */
export default function ComparisonCard({
  title,
  currentValue,
  previousValue,
  formatter = (v) => v,
  currentLabel = 'Actual',
  previousLabel = 'Anterior',
  showPercentage = true
}) {
  const diff = currentValue - previousValue;
  const percentChange = previousValue !== 0 
    ? ((diff / previousValue) * 100) 
    : (currentValue > 0 ? 100 : 0);
  
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const isNeutral = diff === 0;

  const TrendIcon = isPositive ? TrendingUpIcon : isNegative ? TrendingDownIcon : RemoveIcon;
  const trendColor = isPositive 
    ? MARANA_COLORS.primary 
    : isNegative 
    ? MARANA_COLORS.accent 
    : MARANA_COLORS.textSecondary;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        p: 2.5,
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0px 8px 24px ${trendColor}15`,
          borderColor: `${trendColor}40`
        }
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          color: MARANA_COLORS.textSecondary,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: '11px',
          mb: 1.5,
          display: 'block'
        }}
      >
        {title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: MARANA_COLORS.textPrimary }}>
          {formatter(currentValue)}
        </Typography>
        {showPercentage && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 2,
              bgcolor: `${trendColor}15`
            }}
          >
            <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
            <Typography
              variant="caption"
              sx={{
                color: trendColor,
                fontWeight: 700,
                fontSize: '12px'
              }}
            >
              {isPositive ? '+' : ''}{Math.round(percentChange * 10) / 10}%
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: `1px solid ${MARANA_COLORS.border}40` }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
            {currentLabel}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
            {formatter(currentValue)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
            {previousLabel}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', color: MARANA_COLORS.textSecondary }}>
            {formatter(previousValue)}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}