// frontend/src/pages/owner/ai/AIPanel.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Divider,
  Button
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import PlanGate from '../../../components/PlanGate';
import { useRestaurantPlan } from '../../../hooks/useRestaurantPlan';
import { generateAIInsights } from '../../../utils/aiInsights';
import { fetchProducts } from '../../../api/menu';
import { api } from '../../../api';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

export default function AIPanel() {
  const { slug } = useParams();
  const { plan, loading: planLoading } = useRestaurantPlan(slug);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadInsights() {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);

        // Cargar productos y pedidos
        const [productsData, ordersData] = await Promise.all([
          fetchProducts(slug).catch(() => []),
          api.get(`/restaurants/${slug}/orders?limit=1000`).catch(() => ({ data: { data: [] } }))
        ]);

        const products = productsData || [];
        const orders = ordersData?.data?.data || [];

        // Generar insights solo si hay datos
        if (products.length === 0 && orders.length === 0) {
          setError('No hay suficientes datos para generar insights. Necesitas productos y pedidos.');
          setInsights(null);
        } else {
          const aiInsights = generateAIInsights(products, orders, 30);
          setInsights(aiInsights);
        }
      } catch (err) {
        console.error('Error loading AI insights:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (slug && !planLoading) {
      loadInsights();
    }
  }, [slug, planLoading]);

  if (planLoading || loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      </Container>
    );
  }

  return (
    <PlanGate plan={plan} requiredPlan="ULTRA" slug={slug}>
      <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <PsychologyIcon sx={{ fontSize: 40, color: MARANA_COLORS.primary }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              IA Integrada
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Análisis inteligente de tu negocio con sugerencias automatizadas
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Error al cargar insights: {error}
          </Alert>
        )}

        {insights && (
          <Grid container spacing={3}>
            {/* Productos con baja conversión */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TrendingDownIcon sx={{ color: MARANA_COLORS.accent }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Productos con Baja Conversión
                    </Typography>
                  </Box>
                  {insights.lowConversion.length > 0 ? (
                    <List>
                      {insights.lowConversion.map((item, idx) => (
                        <React.Fragment key={idx}>
                          <ListItem>
                            <ListItemText
                              primary={item.product.name}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.recommendation}
                                  </Typography>
                                  <Chip
                                    label={`${item.sales} ventas (30 días)`}
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                          {idx < insights.lowConversion.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="success">
                      ¡Excelente! Todos tus productos tienen buena conversión.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Sugerencias de combos */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LocalOfferIcon sx={{ color: MARANA_COLORS.secondary }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Combos Sugeridos
                    </Typography>
                  </Box>
                  {insights.combos.length > 0 ? (
                    <List>
                      {insights.combos.map((combo, idx) => (
                        <React.Fragment key={idx}>
                          <ListItem>
                            <ListItemText
                              primary={`Combo ${idx + 1}`}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    Estos productos se compran juntos frecuentemente
                                  </Typography>
                                  <Chip
                                    label={`${combo.occurrences} veces juntos`}
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                          {idx < insights.combos.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="info">
                      No hay suficientes datos para sugerir combos. Necesitas más pedidos.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Análisis de estacionalidad */}
            {insights.seasonality && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CalendarTodayIcon sx={{ color: MARANA_COLORS.primary }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Análisis de Estacionalidad
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Día más ocupado:</strong> {insights.seasonality.peakDay.name} 
                        ({insights.seasonality.peakDay.orders} pedidos)
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Día menos ocupado:</strong> {insights.seasonality.lowDay.name} 
                        ({insights.seasonality.lowDay.orders} pedidos)
                      </Typography>
                    </Box>
                    {insights.seasonality.insights.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Recomendaciones:
                        </Typography>
                        <List dense>
                          {insights.seasonality.insights.map((insight, idx) => (
                            <ListItem key={idx} sx={{ py: 0.5 }}>
                              <ListItemText
                                primary={insight}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Mejoras de menú */}
            {insights.menuSuggestions && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <RestaurantMenuIcon sx={{ color: MARANA_COLORS.secondary }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Mejoras de Menú
                      </Typography>
                    </Box>
                    {insights.menuSuggestions.popularWithoutImage.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Productos populares sin imagen:
                        </Typography>
                        <List dense>
                          {insights.menuSuggestions.popularWithoutImage.map((item, idx) => (
                            <ListItem key={idx}>
                              <ListItemText
                                primary={item.product.name}
                                secondary={item.recommendation}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {insights.menuSuggestions.topPerformers.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Productos estrella:
                        </Typography>
                        <List dense>
                          {insights.menuSuggestions.topPerformers.map((item, idx) => (
                            <ListItem key={idx}>
                              <ListItemText
                                primary={item.product.name}
                                secondary={`${item.sales} ventas - ${item.recommendation}`}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </Container>
    </PlanGate>
  );
}

