// frontend/src/components/PlanGate.jsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
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
  
  // Mapear planes antiguos (PLUS) a PRO para compatibilidad
  const normalizedPlan = plan === 'PLUS' ? 'PRO' : plan;

  const currentLevel = planHierarchy[normalizedPlan?.toUpperCase()] || 1;
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
      elevation={0}
      sx={{
        p: 4,
        textAlign: 'center',
        bgcolor: 'var(--mq-surface)',
        border: '1px dashed var(--mq-border-strong)',
        borderRadius: 'var(--mq-radius-lg)',
      }}
    >
      <LockIcon 
        sx={{ 
          fontSize: 48, 
          color: 'var(--mq-text-secondary)',
          mb: 2,
          opacity: 0.5
        }} 
      />
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'var(--mq-text)' }}>
        Función disponible en plan {planNames[requiredPlan]}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'var(--mq-text-secondary)' }}>
        {upgradeMessage || `Actualiza tu plan para acceder a esta funcionalidad avanzada.`}
      </Typography>
      {slug && (
        <Button
          variant="contained"
          onClick={() => navigate(`/owner/${slug}/plan`)}
          sx={{
            bgcolor: 'var(--mq-primary)',
            color: '#fff',
            '&:hover': {
              bgcolor: 'var(--mq-primary)',
              opacity: 0.9,
            },
          }}
        >
          Ver planes disponibles
        </Button>
      )}
    </Paper>
  );
}
