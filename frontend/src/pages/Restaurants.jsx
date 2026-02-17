// src/pages/Restaurants.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  Button,
  CircularProgress,
  Box,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { api } from '../api';

export default function Restaurants() {
  const [rests, setRests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRests() {
      try {
        const res = await api.get('/restaurantes?populate=logo');
        const base = (import.meta.env?.VITE_API_URL || '').replace('/api', '');

        const list = res.data.data.map((r) => {
          const attr = r.attributes || {};
          const logo = attr.logo?.data?.attributes;

          const urlRel =
            r.logo?.formats?.small?.url ||
            r.logo?.formats?.thumbnail?.url ||
            r.logo?.url ||
            null;

          return {
            id: r.id,
            name: r.name,
            slug: r.slug || String(r.id),
            tipo: r.categoria || 'Comida',
            rating: r.rating || '4.5',
            deliveryTime: r.deliveryTime || '20-30 min',
            logo: urlRel ? base + urlRel : null,
          };
        });

        setRests(list);
      } catch (err) {
        console.error('Error cargando restaurantes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRests();
  }, []);

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        ¿Qué te apetece hoy?
      </Typography>
      <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
        Selecciona un restaurante para ver su menú
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rests.map((restaurant) => (
          <Card
            key={restaurant.id}
            sx={{
              p: 2,
              borderRadius: 2,
              boxShadow: 2,
              transition: 'box-shadow 0.3s',
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2 }}>
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }}
              />

              <Box sx={{ flex: 1, position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {restaurant.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {restaurant.tipo}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      backgroundColor: 'success.light',
                      px: 1,
                      borderRadius: 1,
                      height: 24,
                    }}
                  >
                    <StarIcon fontSize="small" sx={{ color: 'success.main' }} />
                    <Typography variant="caption" sx={{ color: 'success.dark' }}>
                      {restaurant.rating}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {restaurant.deliveryTime}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Botón debajo del bloque */}
            <Box mt={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate(`/restaurantes/${restaurant.slug}`)}
              >
                Ver menú
              </Button>
            </Box>
          </Card>
        ))}
      </Box>

      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          ¿No encuentras tu restaurante favorito?
        </Typography>
        <Button variant="outlined">Sugerir restaurante</Button>
      </Box>
    </Container>
  );
}
