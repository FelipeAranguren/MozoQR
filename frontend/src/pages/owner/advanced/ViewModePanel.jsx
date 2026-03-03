// frontend/src/pages/owner/advanced/ViewModePanel.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Switch,
  FormControlLabel
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';

export default function ViewModePanel({ slug }) {
  const [viewMode, setViewMode] = useState('operativa'); // 'operativa' | 'ejecutiva'

  const handleModeChange = (mode) => {
    setViewMode(mode);
    // Guardar preferencia en localStorage
    localStorage.setItem(`viewMode_${slug}`, mode);
  };

  const modes = [
    {
      id: 'operativa',
      title: 'Vista Operativa',
      description: 'Enfocada en el día a día: pedidos en tiempo real, estado de mesas, gestión de productos',
      icon: <DashboardIcon sx={{ fontSize: 48, color: MARANA_COLORS.primary }} />,
      features: [
        'Gestión de pedidos en tiempo real',
        'Estado de mesas y ocupación',
        'Control de productos y disponibilidad',
        'Gestión de personal',
        'Reportes diarios'
      ]
    },
    {
      id: 'ejecutiva',
      title: 'Vista Ejecutiva',
      description: 'Enfocada en análisis y estrategia: métricas, tendencias, rentabilidad, decisiones de negocio',
      icon: <BusinessIcon sx={{ fontSize: 48, color: MARANA_COLORS.secondary }} />,
      features: [
        'KPIs y métricas de negocio',
        'Análisis de rentabilidad',
        'Tendencias y proyecciones',
        'Comparativas y benchmarks',
        'Reportes consolidados'
      ]
    }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Vista Operativa vs Ejecutiva
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={viewMode === 'ejecutiva'}
              onChange={(e) => handleModeChange(e.target.checked ? 'ejecutiva' : 'operativa')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: MARANA_COLORS.secondary
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  bgcolor: MARANA_COLORS.secondary
                }
              }}
            />
          }
          label={viewMode === 'operativa' ? 'Vista Operativa' : 'Vista Ejecutiva'}
        />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Cambia entre vista operativa (día a día) y ejecutiva (análisis estratégico). La preferencia se guarda automáticamente.
      </Alert>

      <Grid container spacing={3}>
        {modes.map((mode) => (
          <Grid item xs={12} md={6} key={mode.id}>
            <Card
              sx={{
                height: '100%',
                border: `2px solid ${viewMode === mode.id ? MARANA_COLORS.primary : MARANA_COLORS.border}`,
                bgcolor: viewMode === mode.id ? `${MARANA_COLORS.primary}05` : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: `0px 8px 24px ${MARANA_COLORS.primary}15`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  {mode.icon}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
                  {mode.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                  {mode.description}
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Características:
                  </Typography>
                  {mode.features.map((feature, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: MARANA_COLORS.primary
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {feature}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Button
                  variant={viewMode === mode.id ? 'contained' : 'outlined'}
                  fullWidth
                  onClick={() => handleModeChange(mode.id)}
                  sx={{
                    bgcolor: viewMode === mode.id ? MARANA_COLORS.primary : 'transparent',
                    borderColor: MARANA_COLORS.primary,
                    color: viewMode === mode.id ? 'white' : MARANA_COLORS.primary,
                    '&:hover': {
                      bgcolor: viewMode === mode.id ? MARANA_COLORS.primary : `${MARANA_COLORS.primary}15`,
                      borderColor: MARANA_COLORS.primary
                    }
                  }}
                >
                  {viewMode === mode.id ? 'Vista Activa' : 'Activar Vista'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="success" sx={{ mt: 3 }}>
        Vista actual: <strong>{viewMode === 'operativa' ? 'Operativa' : 'Ejecutiva'}</strong>. 
        Esta configuración afectará cómo se muestran los datos en el dashboard y otras secciones.
      </Alert>
    </Box>
  );
}

