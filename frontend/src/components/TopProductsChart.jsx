// frontend/src/components/TopProductsChart.jsx
import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemText, LinearProgress } from '@mui/material';
import { MARANA_COLORS } from '../theme';

/**
 * Gráfico visual de productos más vendidos
 */
export default function TopProductsChart({ products = [], limit = 5 }) {
  const topProducts = useMemo(() => {
    return products.slice(0, limit);
  }, [products, limit]);

  const maxQty = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(...topProducts.map(p => p.qty || 0), 1);
  }, [topProducts]);

  const money = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
      .format(Number(n) || 0);

  if (topProducts.length === 0) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          border: `1px solid ${MARANA_COLORS.border}`,
          p: 4,
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No hay datos de productos en este período
        </Typography>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        p: 3
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        Top {limit} Productos
      </Typography>

      <List sx={{ p: 0 }}>
        {topProducts.map((product, idx) => {
          const percentage = maxQty > 0 ? (product.qty / maxQty) * 100 : 0;
          const isTop = idx === 0;

          return (
            <ListItem
              key={product.name || idx}
              sx={{
                borderBottom: idx < topProducts.length - 1 ? `1px solid ${MARANA_COLORS.border}40` : 'none',
                py: 2,
                px: 0,
                flexDirection: 'column',
                alignItems: 'stretch'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 2,
                      bgcolor: isTop 
                        ? `${MARANA_COLORS.primary}15` 
                        : `${MARANA_COLORS.textSecondary}15`,
                      color: isTop 
                        ? MARANA_COLORS.primary 
                        : MARANA_COLORS.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                      flexShrink: 0
                    }}
                  >
                    {idx + 1}
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: isTop ? 700 : 600,
                      fontSize: isTop ? '16px' : '14px',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={product.name}
                  >
                    {product.name || 'Sin nombre'}
                  </Typography>
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: isTop ? MARANA_COLORS.primary : MARANA_COLORS.textPrimary,
                    ml: 2,
                    flexShrink: 0
                  }}
                >
                  {product.qty}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: `${MARANA_COLORS.border}40`,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: isTop
                      ? `linear-gradient(90deg, ${MARANA_COLORS.primary}, ${MARANA_COLORS.primary}dd)`
                      : `linear-gradient(90deg, ${MARANA_COLORS.textSecondary}60, ${MARANA_COLORS.textSecondary}40)`,
                  }
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Card>
  );
}

