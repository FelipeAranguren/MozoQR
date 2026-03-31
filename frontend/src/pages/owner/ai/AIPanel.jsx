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
  Button,
  Stack
} from '@mui/material';
import { MARANA_COLORS, COLORS } from '../../../theme';
import PlanGate from '../../../components/PlanGate';
import { useRestaurantPlan } from '../../../hooks/useRestaurantPlan';
import { generateAIInsights } from '../../../utils/aiInsights';
import { fetchProducts } from '../../../api/menu';
import { getPaidOrdersForAI } from '../../../api/analytics';
import { fetchWeeklyAiReport } from '../../../api/weeklyAi';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CalculateIcon from '@mui/icons-material/Calculate';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

function renderMarkdownLine(line) {
  if (!line) return null;
  const parts = String(line).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function MarkdownLite({ text }) {
  if (!text || !String(text).trim()) return null;
  return (
    <Box sx={{ '& strong': { fontWeight: 700 } }}>
      {String(text).split('\n').map((line, i) => {
        const t = line.trimEnd();
        if (t.startsWith('## ')) {
          return (
            <Typography key={i} variant="h6" sx={{ mt: i === 0 ? 0 : 2, mb: 1, fontWeight: 700 }}>
              {renderMarkdownLine(t.slice(3))}
            </Typography>
          );
        }
        if (t.startsWith('### ')) {
          return (
            <Typography key={i} variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 700 }}>
              {renderMarkdownLine(t.slice(4))}
            </Typography>
          );
        }
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return (
            <Typography key={i} variant="body2" sx={{ pl: 2, mb: 0.5, display: 'block' }}>
              • {renderMarkdownLine(t.slice(2))}
            </Typography>
          );
        }
        if (t.trim() === '') {
          return <Box key={i} sx={{ height: 8 }} />;
        }
        return (
          <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
            {renderMarkdownLine(t)}
          </Typography>
        );
      })}
    </Box>
  );
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function AIPanel() {
  const { slug } = useParams();
  const { plan, loading: planLoading } = useRestaurantPlan(slug);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState(null);
  const [weeklyError, setWeeklyError] = useState(null);
  const [dataStats, setDataStats] = useState({
    products: 0,
    orders: 0,
    ordersWithItems: 0,
    totalItems: 0,
    analysisDays: 30,
  });

  useEffect(() => {
    async function loadInsights() {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);

        // Cargar productos y pedidos pagados del ultimo anio (paginado robusto)
        const rangeEnd = endOfDay(new Date());
        const rangeStart = startOfDay(addDays(rangeEnd, -365));
        const [productsData, ordersData] = await Promise.all([
          fetchProducts(slug).catch(() => []),
          getPaidOrdersForAI({
            slug,
            from: rangeStart.toISOString(),
            to: rangeEnd.toISOString(),
          }).catch(() => []),
        ]);

        const products = productsData || [];
        const orders = Array.isArray(ordersData) ? ordersData : [];

        const ordersWithItems = orders.filter((o) => Array.isArray(o?.items) && o.items.length > 0);
        const totalItems = ordersWithItems.reduce((sum, o) => {
          const qty = (o.items || []).reduce((acc, it) => acc + Number(it?.quantity || it?.qty || 1), 0);
          return sum + qty;
        }, 0);

        // Ventana de analisis adaptativa: si hay historial viejo, aprovecharlo; minimo 30 dias
        const oldest = orders.length
          ? orders.reduce((min, o) => {
              const t = new Date(o.createdAt || o.updatedAt || Date.now()).getTime();
              return Number.isFinite(t) ? Math.min(min, t) : min;
            }, Date.now())
          : Date.now();
        const daysSpan = Math.max(30, Math.ceil((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
        const analysisDays = Math.min(365, daysSpan);

        setDataStats({
          products: products.length,
          orders: orders.length,
          ordersWithItems: ordersWithItems.length,
          totalItems,
          analysisDays,
        });

        // Generar insights solo si hay datos
        if (products.length === 0 && orders.length === 0) {
          setError('No hay suficientes datos para generar insights. Necesitas productos y pedidos.');
          setInsights(null);
        } else {
          const aiInsights = generateAIInsights(products, orders, analysisDays);
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

  useEffect(() => {
    if (!slug || planLoading || String(plan || '').toUpperCase() !== 'ULTRA') {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setWeeklyLoading(true);
      setWeeklyError(null);
      try {
        const data = await fetchWeeklyAiReport(slug);
        if (!cancelled) setWeeklyData(data);
      } catch (e) {
        if (!cancelled) setWeeklyError(e?.response?.data?.error || e?.message || 'Error al cargar informe IA');
      } finally {
        if (!cancelled) setWeeklyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, planLoading, plan]);

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
            <Button
              size="small"
              variant={showDiagnostics ? 'contained' : 'outlined'}
              onClick={() => setShowDiagnostics((v) => !v)}
              sx={{ textTransform: 'none', ml: 'auto' }}
            >
              {showDiagnostics ? 'Ocultar diagnóstico' : 'Modo diagnóstico'}
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Análisis en tiempo real con reglas + informe semanal con IA (Google Gemini, sin tarjeta en Google AI Studio).
          </Typography>
        </Box>

        <Card sx={{ mb: 3, border: `1px solid ${MARANA_COLORS.border}`, boxShadow: COLORS.shadow2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon sx={{ color: MARANA_COLORS.secondary }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Informe semanal (IA)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Se genera como máximo una vez por semana por restaurante usando todo el historial de pedidos pagados
              que podamos leer del servidor (hasta ~12.000 pedidos). La próxima regeneración es automática cuando
              venza el plazo de 7 días.
            </Typography>
            {weeklyLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                <CircularProgress size={28} sx={{ color: MARANA_COLORS.primary }} />
                <Typography variant="body2" color="text.secondary">
                  Generando o cargando informe… (la primera vez puede tardar un minuto)
                </Typography>
              </Box>
            )}
            {!weeklyLoading && weeklyError && (
              <Alert severity="warning">{weeklyError}</Alert>
            )}
            {!weeklyLoading && weeklyData?.missingApiKey && (
              <Alert severity="info" sx={{ mb: 2 }}>
                El servidor aún no tiene configurada la clave de Gemini. Pedile al administrador que agregue{' '}
                <strong>GEMINI_API_KEY</strong> en las variables de entorno (clave gratis en{' '}
                <Box
                  component="a"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: 'inherit', fontWeight: 700 }}
                >
                  Google AI Studio
                </Box>
                ).
              </Alert>
            )}
            {!weeklyLoading && weeklyData?.ok === false && weeklyData?.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {weeklyData.error}
              </Alert>
            )}
            {!weeklyLoading && weeklyData?.generatedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {weeklyData.cached ? 'Desde caché · ' : 'Recién generado · '}
                Fecha: {new Date(weeklyData.generatedAt).toLocaleString('es-AR')}
                {weeklyData.nextRefreshApprox && (
                  <> · Próxima regeneración automática: {new Date(weeklyData.nextRefreshApprox).toLocaleString('es-AR')}</>
                )}
              </Typography>
            )}
            {!weeklyLoading && weeklyData?.reportMarkdown && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  maxHeight: 560,
                  overflow: 'auto',
                }}
              >
                <MarkdownLite text={weeklyData.reportMarkdown} />
              </Box>
            )}
            {!weeklyLoading && !weeklyData?.reportMarkdown && !weeklyData?.missingApiKey && !weeklyError && (
              <Alert severity="info">No hay informe todavía. Cuando el servidor tenga datos y API key, se generará al entrar.</Alert>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Error al cargar insights: {error}
          </Alert>
        )}

        {!error && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Analizando {dataStats.orders} pedido(s) pagado(s), {dataStats.ordersWithItems} con items,
            {` `}{dataStats.totalItems} item(s) totales y {dataStats.products} producto(s) en una ventana de {dataStats.analysisDays} dias.
          </Alert>
        )}
        {!error && showDiagnostics && insights?.diagnostics && (
          <Alert
            severity={insights.diagnostics.matchRate < 0.7 ? 'warning' : 'success'}
            sx={{ mb: 3 }}
          >
            Cobertura de match producto-item: {Math.round((insights.diagnostics.matchRate || 0) * 100)}%
            ({insights.diagnostics.matchedItems}/{insights.diagnostics.totalItems} items).
            {insights.diagnostics.unmatchedSample?.length > 0 && (
              <>
                {' '}No mapeados frecuentes:{' '}
                {insights.diagnostics.unmatchedSample.map((x) => `${x.name} (${x.count})`).join(', ')}.
              </>
            )}
          </Alert>
        )}
        {!error && showDiagnostics && insights?.diagnostics?.unmatchedSample?.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Items no mapeados (debug)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Estos textos llegan en pedidos pero no se pudieron asociar a un producto del menu.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {insights.diagnostics.unmatchedSample.map((x) => (
                  <Chip
                    key={`${x.name}-${x.count}`}
                    label={`${x.name} (${x.count})`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {insights && (
          <Grid container spacing={3}>
            {/* V2: Oportunidades, Riesgos y Simulador */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <RocketLaunchIcon sx={{ color: MARANA_COLORS.primary }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Oportunidades
                    </Typography>
                  </Box>
                  {(insights.strategic?.opportunities || []).length > 0 ? (
                    <List dense>
                      {insights.strategic.opportunities.map((op, idx) => (
                        <React.Fragment key={`${op.title}-${idx}`}>
                          <ListItem alignItems="flex-start">
                            <ListItemText
                              primary={op.title}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    {op.detail}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={`Acción: ${op.action}`}
                                    color={op.priority === 'alta' ? 'error' : 'primary'}
                                    variant="outlined"
                                  />
                                </Box>
                              }
                            />
                          </ListItem>
                          {idx < insights.strategic.opportunities.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="info">No se detectaron oportunidades claras para el período.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <WarningAmberIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Riesgos
                    </Typography>
                  </Box>
                  {(insights.strategic?.risks || []).length > 0 ? (
                    <List dense>
                      {insights.strategic.risks.map((risk, idx) => (
                        <React.Fragment key={`${risk.title}-${idx}`}>
                          <ListItem alignItems="flex-start">
                            <ListItemText
                              primary={risk.title}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">{risk.detail}</Typography>
                                  <Typography variant="caption" color="text.secondary">{risk.impact}</Typography>
                                  <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                      size="small"
                                      label={`Severidad ${risk.severity}`}
                                      color={risk.severity === 'alta' ? 'error' : 'warning'}
                                      variant="outlined"
                                    />
                                  </Box>
                                </Box>
                              }
                            />
                          </ListItem>
                          {idx < insights.strategic.risks.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="success">Sin riesgos críticos detectados en este período.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CalculateIcon sx={{ color: MARANA_COLORS.secondary }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Simulador rápido
                    </Typography>
                  </Box>
                  {insights.strategic?.comboSimulator ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        {insights.strategic.comboSimulator.pair}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Precio base: ${Math.round(insights.strategic.comboSimulator.basePrice)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Precio combo ({insights.strategic.comboSimulator.discountPct}% off): ${Math.round(insights.strategic.comboSimulator.comboPrice)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Combos estimados/mes: {insights.strategic.comboSimulator.estimatedCombos}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
                        Facturación estimada: ${Math.round(insights.strategic.comboSimulator.projectedRevenue)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {insights.strategic.comboSimulator.note}
                      </Typography>
                    </Box>
                  ) : (
                    <Alert severity="info">No hay base suficiente para simular combos.</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

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
                                    label={`${item.sales} ventas (${item.days || dataStats.analysisDays} días)`}
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
                              primary={
                                Array.isArray(combo.productNames) && combo.productNames.length >= 2
                                  ? `${combo.productNames[0]} + ${combo.productNames[1]}`
                                  : `Combo ${idx + 1}`
                              }
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

