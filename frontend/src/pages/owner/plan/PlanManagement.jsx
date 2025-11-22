// frontend/src/pages/owner/plan/PlanManagement.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Container, Card, CardContent, Grid, Chip, CircularProgress } from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import { useRestaurantPlan } from '../../../hooks/useRestaurantPlan';
import CurrentPlanCard from './CurrentPlanCard';
import PlanComparison from './PlanComparison';

export default function PlanManagement() {
  const { slug } = useParams();
  const { plan, restaurant, loading, error } = useRestaurantPlan(slug);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            Error al cargar el plan
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Gestión de Plan
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra tu suscripción y compara planes disponibles
        </Typography>
      </Box>

      {/* Plan actual */}
      <Box sx={{ mb: 4 }}>
        <CurrentPlanCard plan={plan} restaurant={restaurant} />
      </Box>

      {/* Comparación de planes */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          Comparar Planes
        </Typography>
        <PlanComparison currentPlan={plan} slug={slug} />
      </Box>
    </Container>
  );
}
