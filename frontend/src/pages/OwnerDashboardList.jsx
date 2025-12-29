// frontend/src/pages/OwnerDashboardList.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Button,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { api } from '../api';
import { MARANA_COLORS } from '../theme';
import OwnerHeader from '../components/owner/OwnerHeader';

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

export default function OwnerDashboardList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/owner/restaurants');
        const data = response.data?.data || [];
        
        setRestaurants(data);
      } catch (err) {
        console.error('Error cargando restaurantes:', err);
        setError(err.response?.data?.error?.message || 'Error al cargar restaurantes');
      } finally {
        setLoading(false);
      }
    }

    fetchRestaurants();
  }, []);

  const handleSelectRestaurant = (slug) => {
    navigate(`/owner/${slug}/dashboard`);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: MARANA_COLORS.background }}>
        <OwnerHeader />
        <Container maxWidth="lg" sx={{ py: 8, mt: 8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
          </Box>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: MARANA_COLORS.background }}>
        <OwnerHeader />
        <Container maxWidth="lg" sx={{ py: 8, mt: 8 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="error" gutterBottom>
              {error}
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              sx={{ mt: 2 }}
            >
              Reintentar
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: MARANA_COLORS.background }}>
      <OwnerHeader />
      <Container maxWidth="lg" sx={{ py: 8, mt: 8 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: MARANA_COLORS.textPrimary }}>
            Mis Restaurantes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Seleccioná un restaurante para acceder a su dashboard
          </Typography>
        </Box>

        {restaurants.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: `1px solid ${MARANA_COLORS.border}`,
            }}
          >
            <RestaurantIcon sx={{ fontSize: 64, color: MARANA_COLORS.textSecondary, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tenés restaurantes asignados
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contactá al administrador para que te asigne acceso a un restaurante.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {restaurants.map((restaurant) => (
              <Grid item xs={12} sm={6} md={4} key={restaurant.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.12)',
                    },
                  }}
                >
                  {/* Logo o placeholder */}
                  <Box
                    sx={{
                      width: '100%',
                      height: 200,
                      bgcolor: MARANA_COLORS.background,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {restaurant.logo ? (
                      <CardMedia
                        component="img"
                        image={restaurant.logo}
                        alt={restaurant.name}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <RestaurantIcon
                        sx={{
                          fontSize: 80,
                          color: MARANA_COLORS.textSecondary,
                          opacity: 0.3,
                        }}
                      />
                    )}
                    {/* Badge de plan */}
                    <Chip
                      label={restaurant.plan || 'BASIC'}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: MARANA_COLORS.primary,
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
        />
      </Box>

                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        mb: 2,
                        color: MARANA_COLORS.textPrimary,
                      }}
                    >
                      {restaurant.name}
                    </Typography>

                    {/* KPIs */}
                    <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {restaurant.kpis && (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AttachMoneyIcon
                              sx={{ fontSize: 18, color: MARANA_COLORS.primary }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              Ventas hoy:{' '}
                              <strong style={{ color: MARANA_COLORS.textPrimary }}>
                                {money(restaurant.kpis.salesToday || 0)}
                              </strong>
                            </Typography>
          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShoppingCartIcon
                              sx={{ fontSize: 18, color: MARANA_COLORS.secondary }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              Pedidos totales:{' '}
                              <strong style={{ color: MARANA_COLORS.textPrimary }}>
                                {restaurant.kpis.totalOrders || 0}
                              </strong>
                            </Typography>
          </Box>
        </>
      )}
                    </Box>

                    {/* Botón de acción */}
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => handleSelectRestaurant(restaurant.slug)}
        sx={{
                        bgcolor: MARANA_COLORS.primary,
                        '&:hover': {
                          bgcolor: MARANA_COLORS.primary,
                          opacity: 0.9,
                        },
                        mt: 'auto',
                      }}
                    >
                      Seleccionar Restaurante
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
