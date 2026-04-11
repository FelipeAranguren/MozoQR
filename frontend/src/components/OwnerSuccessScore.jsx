// frontend/src/components/OwnerSuccessScore.jsx
import React, { useMemo } from 'react';
import { Box, Typography, LinearProgress, Chip, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { MARANA_COLORS } from '../theme';

/**
 * Componente Owner Success Score
 * Mide qué tan bien está configurado el restaurante
 */
export default function OwnerSuccessScore({ 
  score = 0,           // 0-100
  alerts = [],         // [{ type: 'warning'|'error'|'info', message: string }]
  metrics = {}        // { productsWithoutImage: 0, outdatedPrices: 0, etc }
}) {
  const scoreColor = useMemo(() => {
    if (score >= 90) return MARANA_COLORS.primary;
    if (score >= 70) return MARANA_COLORS.secondary;
    return MARANA_COLORS.accent;
  }, [score]);

  const scoreLabel = useMemo(() => {
    if (score >= 90) return 'Excelente';
    if (score >= 70) return 'Bueno';
    if (score >= 50) return 'Regular';
    return 'Necesita atención';
  }, [score]);

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        p: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${MARANA_COLORS.primary}, ${MARANA_COLORS.secondary})`,
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Owner Success Score
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estado general de tu configuración
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 800, 
              color: scoreColor,
              lineHeight: 1 
            }}
          >
            {Math.round(score)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scoreLabel}
          </Typography>
        </Box>
      </Box>

      {/* Barra de progreso */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={score}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: `${MARANA_COLORS.border}40`,
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}dd)`,
            }
          }}
        />
      </Box>

      {/* Métricas rápidas */}
      {Object.keys(metrics).length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {metrics.productsWithoutImage > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${metrics.productsWithoutImage} sin foto`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
          {metrics.outdatedPrices > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${metrics.outdatedPrices} precios desactualizados`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
          {metrics.missingTables > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${metrics.missingTables} mesas sin configurar`}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {alerts.slice(0, 3).map((alert, idx) => (
            <Alert
              key={idx}
              severity={alert.type}
              icon={
                alert.type === 'error' ? <ErrorIcon /> :
                alert.type === 'warning' ? <WarningIcon /> :
                <CheckCircleIcon />
              }
              sx={{
                borderRadius: 2,
                fontSize: '13px',
                '& .MuiAlert-icon': {
                  fontSize: '20px'
                }
              }}
            >
              {alert.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Mensaje motivacional */}
      {score < 70 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${MARANA_COLORS.border}` }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            💡 Completa tu configuración para mejorar tu score y aprovechar al máximo MarañaQR
          </Typography>
        </Box>
      )}
    </Box>
  );
}

