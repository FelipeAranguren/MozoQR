// frontend/src/pages/owner/plan/CurrentPlanCard.jsx
import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { MARANA_COLORS } from '../../../theme';

const planInfo = {
  BASIC: {
    name: 'Básico',
    description: 'Control operacional esencial',
    color: MARANA_COLORS.textSecondary,
    bgColor: `${MARANA_COLORS.textSecondary}15`
  },
  PRO: {
    name: 'Pro',
    description: 'Optimización con datos y análisis avanzados',
    color: MARANA_COLORS.secondary,
    bgColor: `${MARANA_COLORS.secondary}15`
  },
  ULTRA: {
    name: 'Ultra',
    description: 'Inteligencia y automatización total',
    color: MARANA_COLORS.primary,
    bgColor: `${MARANA_COLORS.primary}15`
  }
};

export default function CurrentPlanCard({ plan, restaurant }) {
  const planData = planInfo[plan] || planInfo.BASIC;

  return (
    <Card
      sx={{
        border: `2px solid ${planData.color}`,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${planData.bgColor} 0%, #ffffff 100%)`,
        boxShadow: `0px 8px 24px ${planData.color}25`
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Chip
                label={planData.name}
                sx={{
                  bgcolor: planData.color,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '16px',
                  height: 32,
                  px: 1
                }}
              />
              <Chip
                icon={<CheckCircleIcon />}
                label="Plan Activo"
                sx={{
                  bgcolor: `${MARANA_COLORS.primary}15`,
                  color: MARANA_COLORS.primary,
                  fontWeight: 600
                }}
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {planData.description}
            </Typography>
            {restaurant && (
              <Typography variant="body2" color="text.secondary">
                Restaurante: {restaurant.name}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

