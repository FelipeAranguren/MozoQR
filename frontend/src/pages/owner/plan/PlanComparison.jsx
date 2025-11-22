// frontend/src/pages/owner/plan/PlanComparison.jsx
import React from 'react';
import { Grid, Card, CardContent, Box, Typography, Button, List, ListItem, ListItemIcon, ListItemText, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { MARANA_COLORS } from '../../../theme';

const plans = {
  BASIC: {
    name: 'Básico',
    price: 'Gratis',
    description: 'Control operacional esencial',
    color: MARANA_COLORS.textSecondary,
    features: [
      'KPIs básicos (ventas diarias, pedidos, ticket promedio)',
      'Vista rápida de mesas (estado, pedidos activos)',
      'Gestión básica (CRUD productos, categorías, mesas)',
      'Disponibilidad de productos',
      'Editar logo y colores',
      'Actividad reciente (últimos pedidos, cuentas pagadas)',
      'Insights simples (top productos, horas pico)'
    ],
    limitations: [
      'Sin análisis avanzados',
      'Sin predicciones',
      'Sin comparativas semanales',
      'Sin exportaciones',
      'Sin múltiples sucursales'
    ]
  },
  PRO: {
    name: 'Pro',
    price: 'Consultar',
    description: 'Optimización con datos y análisis avanzados',
    color: MARANA_COLORS.secondary,
    features: [
      'Todo lo de Básico',
      'Analytics avanzados (ventas semanales, tendencias)',
      'Top 5 productos del mes',
      'Comparativa HOY vs AYER',
      'Horas pico del negocio',
      'Productos frecuentemente sin stock',
      'Predicciones simples (ventas diarias, demanda)',
      'Health Check completo',
      'Roles de personal',
      'Reporte diario de caja',
      'Historial de transacciones',
      'Notificaciones de stock bajo',
      'Análisis de rentabilidad básico',
      'Comparativas semanales/mensuales'
    ],
    limitations: [
      'Sin IA integrada',
      'Sin múltiples sucursales',
      'Sin exportaciones avanzadas',
      'Sin análisis de estacionalidad'
    ]
  },
  ULTRA: {
    name: 'Ultra',
    price: 'Consultar',
    description: 'Inteligencia y automatización total',
    color: MARANA_COLORS.primary,
    features: [
      'Todo lo de Pro',
      'Análisis de rentabilidad completo (márgenes, productos más/menos rentables)',
      'Ranking de mesas más rentables',
      'Tiempos promedio de preparación',
      'Tiempo promedio de ocupación de mesas',
      'Heatmap de horas pico',
      'Comparación entre sucursales',
      'Funnel de clientes',
      'Panel Profit Optimizer',
      'IA integrada (sugerencias de menú, combos, detección de productos)',
      'Análisis de estacionalidad',
      'Múltiples sucursales',
      'Panel consolidado',
      'Exportaciones CSV/PDF',
      'Auditorías completas',
      'Logs de usuario',
      'Sistema de tareas',
      'Integración de pagos online',
      'Suscripciones y facturación',
      'Vista Operativa vs Ejecutiva'
    ],
    limitations: []
  }
};

const planHierarchy = {
  BASIC: 1,
  PRO: 2,
  ULTRA: 3
};

export default function PlanComparison({ currentPlan, slug }) {
  const currentLevel = planHierarchy[currentPlan] || 1;

  const handleUpgrade = (targetPlan) => {
    // Por ahora solo muestra un mensaje, luego se puede integrar con sistema de pagos
    alert(`Funcionalidad de upgrade a ${targetPlan} en desarrollo. Próximamente podrás cambiar tu plan desde aquí.`);
  };

  return (
    <Grid container spacing={3}>
      {Object.entries(plans).map(([planKey, planData]) => {
        const planLevel = planHierarchy[planKey] || 1;
        const isCurrent = planKey === currentPlan;
        const canUpgrade = planLevel > currentLevel;
        const isLower = planLevel < currentLevel;

        return (
          <Grid item xs={12} md={4} key={planKey}>
            <Card
              sx={{
                border: `2px solid ${isCurrent ? planData.color : MARANA_COLORS.border}`,
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: `0px 8px 24px ${planData.color}25`,
                  transform: 'translateY(-4px)'
                }
              }}
            >
              {isCurrent && (
                <Chip
                  label="Plan Actual"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    bgcolor: planData.color,
                    color: 'white',
                    fontWeight: 700,
                    zIndex: 1
                  }}
                />
              )}
              
              <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: planData.color }}>
                    {planData.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {planData.description}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: planData.color }}>
                    {planData.price}
                  </Typography>
                </Box>

                <Box sx={{ flexGrow: 1, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Incluye:
                  </Typography>
                  <List dense sx={{ mb: 2 }}>
                    {planData.features.map((feature, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckIcon sx={{ color: MARANA_COLORS.primary, fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { fontSize: '13px' }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>

                  {planData.limitations.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: MARANA_COLORS.textSecondary }}>
                        No incluye:
                      </Typography>
                      <List dense>
                        {planData.limitations.map((limitation, idx) => (
                          <ListItem key={idx} sx={{ py: 0.5, px: 0 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CloseIcon sx={{ color: MARANA_COLORS.textSecondary, fontSize: 20, opacity: 0.5 }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={limitation}
                              primaryTypographyProps={{
                                variant: 'body2',
                                sx: { fontSize: '13px', color: MARANA_COLORS.textSecondary, opacity: 0.7 }
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </Box>

                <Button
                  variant={isCurrent ? 'outlined' : 'contained'}
                  fullWidth
                  disabled={isCurrent || isLower}
                  onClick={() => handleUpgrade(planKey)}
                  sx={{
                    bgcolor: isCurrent ? 'transparent' : planData.color,
                    color: isCurrent ? planData.color : 'white',
                    borderColor: planData.color,
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: isCurrent ? `${planData.color}15` : planData.color,
                      opacity: 0.9
                    },
                    '&:disabled': {
                      bgcolor: MARANA_COLORS.background,
                      color: MARANA_COLORS.textSecondary,
                      borderColor: MARANA_COLORS.border
                    }
                  }}
                >
                  {isCurrent ? 'Plan Actual' : isLower ? 'Plan Inferior' : `Upgrade a ${planData.name}`}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

