// frontend/src/components/PlanGate.jsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { MARANA_COLORS } from '../theme';
import { useNavigate } from 'react-router-dom';

/**
 * Componente para mostrar contenido solo si el plan lo permite
 * Si no tiene acceso, muestra un mensaje de upgrade
 */
export default function PlanGate({ 
  plan,           // Plan actual del restaurante
  requiredPlan,   // Plan mínimo requerido: 'BASIC' | 'PRO' | 'ULTRA'
  children,
  upgradeMessage,
  slug
}) {
  const navigate = useNavigate();

  const planHierarchy = {
    'BASIC': 1,
    'PRO': 2,
    'ULTRA': 3
  };

  const currentLevel = planHierarchy[plan?.toUpperCase()] || 1;
  const requiredLevel = planHierarchy[requiredPlan?.toUpperCase()] || 1;

  if (currentLevel >= requiredLevel) {
    return <>{children}</>;
  }

  const planNames = {
    'BASIC': 'Básico',
    'PRO': 'Pro',
    'ULTRA': 'Ultra'
  };

  return (
    <Paper
      sx={{
        p: 4,
        textAlign: 'center',
        background: `linear-gradient(135deg, ${MARANA_COLORS.background} 0%, #ffffff 100%)`,
        border: `2px dashed ${MARANA_COLORS.border}`,
        borderRadius: 3
      }}
    >
      <LockIcon 
        sx={{ 
          fontSize: 48, 
          color: MARANA_COLORS.textSecondary,
          mb: 2,
          opacity: 0.5
        }} 
      />
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
        Función disponible en plan {planNames[requiredPlan]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {upgradeMessage || `Actualiza tu plan para acceder a esta funcionalidad avanzada.`}
      </Typography>
      {slug && (
        <Button
          variant="contained"
          onClick={() => navigate(`/owner/${slug}/plan`)}
          sx={{
            bgcolor: MARANA_COLORS.primary,
            '&:hover': {
              bgcolor: MARANA_COLORS.primary,
              opacity: 0.9
            }
          }}
        >
          Ver planes disponibles
        </Button>
      )}
    </Paper>
  );
}

