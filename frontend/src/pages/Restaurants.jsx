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
  Chip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { api } from '../api';
import { getStrapiPublicBase } from '../utils/strapiPublicBase';

export default function Restaurants() {
  const [rests, setRests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRests() {
      try {
        const res = await api.get('/restaurantes?populate=logo');
        const base = getStrapiPublicBase();

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
    <Box sx={{ py: { xs: 4, sm: 6 } }}>
    <Container maxWidth="md">
      <Box className="premium-panel" sx={{ p: { xs: 3, sm: 4 }, mb: 4, textAlign: 'center' }}>
        <Typography className="premium-kicker" sx={{ mb: 1 }}>Explorar</Typography>
        <Typography variant="h2" align="center" gutterBottom>
          ¿Qué te apetece hoy?
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
          Selecciona un restaurante para ver su menú, revisar disponibilidad y empezar a pedir desde la mesa.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
        {rests.map((restaurant) => (
          <Card
            key={restaurant.id}
            sx={{
              p: 0,
              borderRadius: 5,
              overflow: 'hidden',
              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              '&:hover': {
                boxShadow: '0 22px 40px rgba(46,34,18,0.1)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, p: 2.5 }}>
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                style={{ width: 92, height: 92, borderRadius: 20, objectFit: 'cover', background: '#f8f4ec' }}
              />

              <Box sx={{ flex: 1, position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {restaurant.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {restaurant.tipo}
                    </Typography>
                    <Chip label="Menú digital" size="small" sx={{ mt: 0.5 }} />
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      backgroundColor: 'rgba(35,122,87,0.12)',
                      px: 1,
                      borderRadius: 999,
                      height: 28,
                      border: '1px solid rgba(35,122,87,0.18)',
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

            <Box mt={0} sx={{ px: 2.5, pb: 2.5 }}>
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

      <Box className="premium-panel-soft" sx={{ textAlign: 'center', mt: 5, p: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          ¿No encuentras tu restaurante favorito?
        </Typography>
        <Button variant="outlined">Sugerir restaurante</Button>
      </Box>
    </Container>
    </Box>
  );
}
