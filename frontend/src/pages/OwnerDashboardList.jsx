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
  CardActionArea,
  Grid,
  CircularProgress,
  Chip,
} from '@mui/material';
import axios from 'axios';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

// Helper para obtener token
function getToken() {
  return localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt') || null;
}

// Helper para hacer requests autenticados
async function fetchWithAuth(url) {
  const token = getToken();
  if (!token) {
    throw new Error('No hay token disponible');
  }
  
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  console.log('📤 Request a:', `${API_URL}${url}`);
  console.log('📤 Headers:', { ...headers, Authorization: 'Bearer ***' });
  
  const res = await axios.get(`${API_URL}${url}`, { headers });
  return res.data;
}

const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

export default function OwnerDashboardList() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRestaurants() {
      try {
        setLoading(true);
        setError(null);
        
        // Verificar que hay token
        const token = getToken();
        if (!token) {
          setError('No estás logueado. Por favor, inicia sesión.');
          setLoading(false);
          return;
        }

        console.log('🔑 Token encontrado, haciendo request...');
        const res = await fetchWithAuth('/owner/restaurants');
        console.log('✅ Response recibida:', res);
        
        const data = res?.data || [];
        setRestaurants(data);
        setError(null);
        
        if (data.length === 0) {
          console.log('⚠️ No hay restaurantes asignados');
        }
      } catch (err) {
        console.error('❌ Error cargando restaurantes:', err);
        console.error('❌ Error response:', err?.response?.data);
        console.error('❌ Error status:', err?.response?.status);
        
        // Mensaje de error más específico
        if (err?.response?.status === 401) {
          setError('No estás autenticado. Por favor, inicia sesión nuevamente.');
        } else if (err?.response?.status === 403) {
          setError('No tenés permisos para ver esta información.');
        } else if (err?.response?.status === 404) {
          setError('El endpoint no existe. Verificá la configuración del backend.');
        } else if (err?.response?.data?.error?.message) {
          setError(`Error: ${err.response.data.error.message}`);
        } else {
          setError(`Error al cargar restaurantes: ${err?.message || 'Error desconocido'}`);
        }
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    }

    fetchRestaurants();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }

  if (restaurants.length === 0) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          No tenés restaurantes asignados
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Contactá al administrador para que te asigne un restaurante.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Mis Restaurantes
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Seleccioná un restaurante para ver su dashboard y estadísticas
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {restaurants.map((restaurant) => (
          <Grid item xs={12} sm={6} md={4} key={restaurant.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/owner/${restaurant.slug}/dashboard`)}
                sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
              >
                {restaurant.logo && (
                  <CardMedia
                    component="img"
                    image={restaurant.logo}
                    alt={restaurant.name}
                    sx={{
                      height: 180,
                      objectFit: 'cover',
                      bgcolor: 'grey.100',
                    }}
                  />
                )}
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 700, flex: 1 }}>
                      {restaurant.name}
                    </Typography>
                    <Chip
                      label={restaurant.plan}
                      size="small"
                      color={restaurant.plan === 'PRO' || restaurant.plan === 'ULTRA' ? 'primary' : 'default'}
                      sx={{ ml: 1 }}
                    />
                  </Box>

                  <Box sx={{ mt: 'auto', pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Ventas hoy:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {money(restaurant.kpis?.salesToday || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Total pedidos:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {restaurant.kpis?.totalOrders || 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
