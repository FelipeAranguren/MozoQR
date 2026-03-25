//src/pages/Home.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Container, Typography, Button, Grid, Card, Box, List, ListItem, ListItemIcon, ListItemText, CircularProgress, Stack, Paper, useTheme } from '@mui/material'
import QrCodeIcon from '@mui/icons-material/QrCode'
import KitchenIcon from '@mui/icons-material/Kitchen'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import InsightsIcon from '@mui/icons-material/Insights'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import PaymentsIcon from '@mui/icons-material/Payments'
import heroImage from '../assets/hero-image.jpg'
import { alpha } from '@mui/material/styles'
import { MARANA_COLORS } from '../theme'
import { useDolarBlue } from '../hooks/useDolarBlue'
import { formatPriceARS, formatPriceUSD } from '../constants/planPricing'

export default function Home() {
  const navigate = useNavigate()
  const theme = useTheme()
  const { blueVenta, loading: dolarLoading } = useDolarBlue()

  const features = [
    {
      icon: <QrCodeIcon sx={{ fontSize: 40 }} />,
      title: 'Pedidos desde la mesa',
      desc: 'El comensal abre el menú con QR, puede iniciar una cuenta y enviar pedidos que llegan al instante a cocina y sala.',
      color: '#2196F3'
    },
    {
      icon: <KitchenIcon sx={{ fontSize: 40 }} />,
      title: 'Cocina y mozos alineados',
      desc: 'Los pedidos se preparan y sirven en orden: menos idas y vueltas, más claridad entre mesa, barra y cocina.',
      color: '#009688'
    },
    {
      icon: <ReceiptLongIcon sx={{ fontSize: 40 }} />,
      title: 'Cuenta de mesa automática',
      desc: 'Todo lo pedido queda en una sola cuenta digital: menos confusiones al sumar y cerrar, y opción de pagar sin tener que pedir la cuenta.',
      color: '#4CAF50'
    },
    {
      icon: <InsightsIcon sx={{ fontSize: 40 }} />,
      title: 'Dueño: operación y finanzas',
      desc: 'Estadísticas como horarios pico, facturación e historial, más una IA que sugiere ajustes para ordenar tu negocio.',
      color: '#FF9800'
    }
  ]

  const benefits = [
    'Un solo flujo digital para comensales, cocina y caja.',
    'Menos traslado de pedidos a mano: lo que pide el cliente queda registrado en el sistema.',
    'Visibilidad para el dueño: qué se vende, cuándo se concentra la demanda y cómo cerrar la caja.',
    'Pagos integrados al recorrido del cliente, sin depender de que alguien traiga la cuenta.',
    'Escalable por plan: desde lo esencial hasta análisis avanzados e IA según tu suscripción.',
    'Probá el recorrido completo en el entorno de demostración antes de comprometerte.'
  ]

  const flowPillars = [
    {
      title: 'En el salón',
      subtitle: 'Experiencia del comensal',
      body: 'Escanea, arma su pedido en una cuenta vinculada a la mesa y puede pagar cuando quiera, sin fricción extra al cerrar.'
    },
    {
      title: 'En cocina y piso',
      subtitle: 'Operación del día a día',
      body: 'Los pedidos entran en tiempo real; el equipo ve qué cocinar y qué servir sin depender de papelitos sueltos o mensajes cruzados.'
    },
    {
      title: 'En la oficina',
      subtitle: 'Control del dueño',
      body: 'Facturas, picos de demanda y reportes en un panel pensado para decidir con información, más recomendaciones de IA cuando tu plan lo incluye.'
    }
  ]

  // Planes (misma estructura y beneficios que OwnerDashboard PlanComparison). Precios en USD.
  const plans = {
    BASIC: {
      name: 'Básico',
      // Precio simbólico para pruebas
      priceUsd: 0.0007,
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
      ],
      cta: 'Elegir plan',
      ctaAction: () => navigate('/checkout?plan=basic')
    },
    PRO: {
      name: 'Pro',
      priceUsd: 80,
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
      ],
      cta: 'Elegir plan',
      ctaAction: () => navigate('/checkout?plan=pro')
    },
    ULTRA: {
      name: 'Ultra',
      priceUsd: 100,
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
      limitations: [],
      cta: 'Elegir plan',
      ctaAction: () => navigate('/checkout?plan=ultra')
    }
  }

  const heroHighlights = [
    {
      title: 'Tiempo real',
      subtitle: 'Pedidos visibles en cocina y sala al momento.',
      icon: <SyncAltIcon sx={{ fontSize: 26 }} />,
      color: theme.palette.primary.main
    },
    {
      title: 'Una cuenta',
      subtitle: 'Todo lo pedido en la mesa, en un solo lugar.',
      icon: <TableRestaurantIcon sx={{ fontSize: 26 }} />,
      color: theme.palette.secondary?.main || theme.palette.primary.main
    },
    {
      title: 'Pagos digitales',
      subtitle: 'Cerrar sin pedir la cuenta en voz alta.',
      icon: <PaymentsIcon sx={{ fontSize: 26 }} />,
      color: '#2E7D32'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    <Box component="main" sx={{ overflowX: 'hidden', width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* Hero Section */}
      <Box sx={{
        py: { xs: 6, md: 12 },
        background: 'linear-gradient(to bottom right, #e0f2f1, #ffffff)',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: { xs: '-15%', md: '-30%' },
          right: { xs: 0, md: '-15%' },
          width: { xs: 'min(72vw, 260px)', md: '45%' },
          height: { xs: '42%', md: '85%' },
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          transform: { xs: 'translateX(15%)', md: 'none' }
        }
      }}>
        <Container sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: 1 } }}>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                
                <Typography
                  variant="h2"
                  fontWeight="bold"
                  gutterBottom
                  sx={{
                    fontSize: { xs: '1.75rem', sm: '2rem', md: '3rem', lg: '3.5rem' },
                    lineHeight: 1.25
                  }}
                >
                  Un solo sistema para{' '}
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    mesa, cocina y finanzas
                  </Box>
                </Typography>

                <Typography
                  variant="h6"
                  color="textSecondary"
                  component="p"
                  sx={{
                    fontSize: { xs: '1rem', sm: '1.0625rem', md: '1.25rem' },
                    mt: 2,
                    mb: { xs: 3, md: 3.5 },
                    lineHeight: 1.65,
                    maxWidth: { md: 520, lg: 540 }
                  }}
                >
                  MozoQR conecta la mesa con la cocina y el panel del dueño: pedidos claros, cuenta automática por mesa, pagos sin pedir la cuenta, y herramientas para ver picos, facturación y sugerencias con IA.
                </Typography>

                <Stack
                  spacing={{ xs: 1.5, sm: 2 }}
                  sx={{
                    mb: { xs: 3, md: 4 },
                    width: '100%',
                    maxWidth: { md: 520, lg: 'none' }
                  }}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ width: '100%' }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={() => navigate('/demo')}
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        py: 1.5,
                        fontSize: { xs: '0.95rem', sm: '1rem' },
                        fontWeight: 600,
                        boxShadow: 3,
                        borderRadius: 2,
                        minHeight: 48,
                        '&:hover': { boxShadow: 6 }
                      }}
                    >
                      Probar gratis ahora
                    </Button>
                  </motion.div>

                  <Stack
                    direction="row"
                    spacing={{ xs: 1, sm: 2 }}
                    sx={{ width: '100%' }}
                  >
                    {[
                      {
                        label: 'Ver planes',
                        onClick: () => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })
                      },
                      {
                        label: 'Contactar ventas',
                        href: 'mailto:ventas@mozoqr.com'
                      }
                    ].map((item) => (
                      <motion.div
                        key={item.label}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ flex: 1, minWidth: 0, width: '100%' }}
                      >
                        <Button
                          variant="outlined"
                          size="large"
                          fullWidth
                          href={item.href}
                          onClick={item.onClick}
                          sx={{
                            py: 1.5,
                            px: { xs: 0.75, sm: 2 },
                            fontSize: { xs: '0.8125rem', sm: '1rem' },
                            fontWeight: 600,
                            borderWidth: 2,
                            borderRadius: 2,
                            minHeight: 48,
                            whiteSpace: 'normal',
                            lineHeight: 1.25,
                            textAlign: 'center',
                            '&:hover': { borderWidth: 2 }
                          }}
                        >
                          {item.label}
                        </Button>
                      </motion.div>
                    ))}
                  </Stack>
                </Stack>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={6} sx={{ order: { xs: 3, md: 2 } }}>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Box sx={{ position: 'relative' }}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Box
                      component="img"
                      src={heroImage}
                      alt="Mesa de restaurante con QR"
                      sx={{
                        width: '100%',
                        borderRadius: 4,
                        boxShadow: 6
                      }}
                    />
                  </motion.div>

                  {/* Floating card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    <Card
                      sx={{
                        position: 'absolute',
                        bottom: -24,
                        left: { xs: 0, md: 12 },
                        maxWidth: { xs: 'none', md: 'calc(100% - 24px)' },
                        boxShadow: 4,
                        borderRadius: 2,
                        p: 2,
                        display: { xs: 'none', md: 'block' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            bgcolor: 'success.light',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Pedido confirmado
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Visible en cocina al instante
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </motion.div>
                </Box>
              </motion.div>
            </Grid>

            <Grid item xs={12} sx={{ order: { xs: 2, md: 3 } }}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
              >
                <Grid container spacing={{ xs: 2, md: 3 }}>
                  {heroHighlights.map((h, i) => (
                    <Grid item xs={12} sm={4} key={h.title}>
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 + i * 0.08, duration: 0.45 }}
                        whileHover={{ y: -4 }}
                        style={{ height: '100%' }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            height: '100%',
                            p: { xs: 2, md: 2.5 },
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(8px)',
                            transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            alignItems: { xs: 'stretch', md: 'flex-start' },
                            gap: { xs: 1.5, md: 2.25 },
                            minHeight: { md: 148 },
                            '&:hover': {
                              boxShadow: '0 12px 32px rgba(0,0,0,0.09)',
                              borderColor: alpha(h.color, 0.45)
                            }
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 48, md: 52 },
                              height: { xs: 48, md: 52 },
                              borderRadius: 2,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: h.color,
                              bgcolor: alpha(h.color, 0.12)
                            }}
                          >
                            {h.icon}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'left', md: 'left' } }}>
                            <Typography variant="subtitle1" fontWeight="bold" color="text.primary" gutterBottom sx={{ mb: { xs: 0.5, md: 0.75 } }}>
                              {h.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, fontSize: { md: '0.9375rem' } }}>
                              {h.subtitle}
                            </Typography>
                          </Box>
                        </Paper>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#f9f9f9' }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
              De la mesa al dueño,{' '}
                <span style={{ color: theme.palette.primary.main }}>sin saltos</span>
            </Typography>
            <Typography variant="subtitle1" align="center" color="textSecondary" paragraph sx={{ mb: 4 }}>
              Un mismo recorrido para quien come, quien cocina y quien administra: menos fricción operativa y más claridad financiera.
            </Typography>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Grid container spacing={4}>
              {features.map((f, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -8 }}
                  >
                    <Card
                      elevation={2}
                      sx={{
                        textAlign: 'center',
                        p: 3,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 240,
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-8px)'
                        }
                      }}
                    >
                      <Box
                        sx={{
                          mb: 2,
                          display: 'flex',
                          justifyContent: 'center',
                          '& svg': {
                            color: f.color
                          }
                        }}
                      >
                        {f.icon}
                      </Box>
                      <Typography variant="h6" gutterBottom fontWeight="bold">
                        {f.title}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {f.desc}
                      </Typography>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Planes / Precios */}
      <Box id="planes" sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#ffffff' }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
              Planes que se adaptan a tu{' '}
                <span style={{ color: theme.palette.primary.main }}>negocio</span>
            </Typography>
            <Typography variant="subtitle1" align="center" color="textSecondary" paragraph sx={{ mb: 4 }}>
              Elige el nivel que mejor se ajuste a tu restaurante. Empieza gratis y escala cuando lo necesites.
            </Typography>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Grid container spacing={3}>
              {Object.entries(plans).map(([planKey, planData]) => (
                <Grid item xs={12} sm={6} md={4} key={planKey}>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -8 }}
                  >
                    <Card
                      elevation={2}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        border: `2px solid ${planData.color}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: `0 12px 40px ${planData.color}40`,
                          transform: 'translateY(-8px)'
                        }
                      }}
                    >
                      <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: planData.color, mb: 0.5 }}>
                          {planData.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {planData.description}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                          {dolarLoading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={24} sx={{ color: planData.color }} />
                              <Typography variant="body2" color="text.secondary">Cargando precio…</Typography>
                            </Box>
                          ) : (
                            <>
                              <Typography variant="h4" fontWeight="bold" sx={{ color: planData.color }}>
                                {formatPriceARS(planData.priceUsd * blueVenta)}
                                <Typography component="span" variant="body2" fontWeight="500" color="text.secondary" sx={{ ml: 0.5 }}>
                                  /mes
                                </Typography>
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                ({formatPriceUSD(planData.priceUsd)})
                              </Typography>
                            </>
                          )}
                        </Box>

                        <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>
                          Incluye:
                        </Typography>
                        <List dense sx={{ mb: planData.limitations?.length ? 2 : 3, flex: 1 }}>
                          {planData.features.map((feature, idx) => (
                            <ListItem key={idx} sx={{ py: 0.25, px: 0 }}>
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <CheckIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={feature}
                                primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.8125rem' } }}
                              />
                            </ListItem>
                          ))}
                        </List>

                        {planData.limitations?.length > 0 && (
                          <>
                            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1, color: 'text.secondary' }}>
                              No incluye:
                            </Typography>
                            <List dense sx={{ mb: 2 }}>
                              {planData.limitations.map((limitation, idx) => (
                                <ListItem key={idx} sx={{ py: 0.25, px: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 28 }}>
                                    <CloseIcon sx={{ color: 'text.secondary', fontSize: 18, opacity: 0.6 }} />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={limitation}
                                    primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.8125rem', color: 'text.secondary', opacity: 0.9 } }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </>
                        )}

                        <motion.div
                          style={{ marginTop: 'auto' }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={planData.ctaAction}
                            endIcon={<ArrowForwardIcon />}
                            sx={{
                              bgcolor: planData.color,
                              py: 1.5,
                              fontWeight: 600,
                              borderRadius: 2,
                              textTransform: 'none',
                              boxShadow: 2,
                              '&:hover': {
                                bgcolor: planData.color,
                                filter: 'brightness(0.92)',
                                boxShadow: 4
                              }
                            }}
                          >
                            {planData.cta}
                          </Button>
                        </motion.div>
                      </Box>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
            <Typography variant="caption" display="block" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
              Cotización del dólar blue utilizada: {formatPriceARS(blueVenta)}
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#f9f9f9' }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Typography variant="h4" gutterBottom fontWeight="bold">
                  Qué aporta{' '}
                <span style={{ color: theme.palette.primary.main }}>a tu operación</span>
                </Typography>
                <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 4 }}>
                  No prometemos porcentajes mágicos: MozoQR está pensado para ordenar procesos que hoy suelen repartirse entre papel, memoria y mensajes sueltos.
                </Typography>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  <Box sx={{ mt: 2 }}>
                    {benefits.map((text, i) => (
                      <motion.div
                        key={i}
                        variants={itemVariants}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            mb: 2,
                            p: 2,
                            borderRadius: 2,
                            '&:hover': {
                              bgcolor: 'action.hover'
                            },
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <CheckCircleIcon color="success" sx={{ mt: 0.25, flexShrink: 0 }} />
                          <Typography variant="body1" fontWeight={500}>
                            {text}
                          </Typography>
                        </Box>
                      </motion.div>
                    ))}
                  </Box>
                </motion.div>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Card
                  elevation={1}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    background: 'linear-gradient(to bottom right, #e0f2f1, #fff8e1)',
                    boxShadow: 4
                  }}
                >
                  <Typography variant="h5" gutterBottom fontWeight="bold">
                    Comienza hoy mismo
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph sx={{ mb: 3 }}>
                    Recorré la demo con rol de comensal, cocina y dueño. Sin tarjeta para explorar el flujo.
                  </Typography>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => navigate('/demo')}
                      sx={{
                        mb: 3,
                        py: 1.5,
                        boxShadow: 3,
                        '&:hover': {
                          boxShadow: 6
                        }
                      }}
                    >
                      Empezar demostración
                    </Button>
                  </motion.div>

                  <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                      <Typography variant="body2" color="textSecondary">
                        Sin tarjeta de crédito
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                      <Typography variant="body2" color="textSecondary">
                        Cancelación en cualquier momento
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Tres frentes del producto (sin reseñas inventadas) */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#f9f9f9' }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
              Tres lugares,{' '}
                <span style={{ color: theme.palette.primary.main }}>un mismo flujo</span>
            </Typography>
            <Typography variant="subtitle1" align="center" color="textSecondary" paragraph sx={{ mb: 4 }}>
              Así encaja MozoQR en el día a día: del comensal al fogón y del fogón al panel del dueño.
            </Typography>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Grid container spacing={4}>
              {flowPillars.map((pillar, index) => (
                <Grid item xs={12} md={4} key={pillar.title}>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -8 }}
                  >
                    <Card
                      elevation={2}
                      sx={{
                        p: 3,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.3s',
                        borderTop: 4,
                        borderColor: index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'success.main',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-8px)'
                        }
                      }}
                    >
                      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        {pillar.subtitle}
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {pillar.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ flex: 1, lineHeight: 1.65 }}
                      >
                        {pillar.body}
                      </Typography>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Final CTA Section */}
      <Box sx={{
        py: { xs: 8, md: 12 },
        background: `linear-gradient(to bottom right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Typography
                  variant="h4"
                  gutterBottom
                  fontWeight="bold"
                  sx={{
                    color: 'white',
                    fontSize: { xs: '2rem', md: '2.5rem' },
                    mb: 2
                  }}
                >
                  ¿Querés ver MozoQR en acción?
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <Typography
                  variant="h6"
                  paragraph
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    mb: 4
                  }}
                >
                  Entrá a la demo: probá pedidos, cocina y panel de dueño con datos de ejemplo, y elegí el plan cuando encaje con tu negocio.
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => navigate('/demo')}
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        px: 4,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        boxShadow: 6,
                        '&:hover': {
                          bgcolor: 'grey.100',
                          boxShadow: 8
                        }
                      }}
                    >
                      Comenzar gratis ahora
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outlined"
                      size="large"
                      href="mailto:ventas@mozoqr.com"
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        borderWidth: 2,
                        px: 4,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        '&:hover': {
                          borderColor: 'white',
                          borderWidth: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.1)'
                        }
                      }}
                    >
                      Contactar Ventas
                    </Button>
                  </motion.div>
                </Box>
              </motion.div>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#212121', color: '#f5f5f5', py: 6 }}>
        <Container>
          <Typography variant="h5" align="center" gutterBottom>
            MozoQR
          </Typography>
          <Typography variant="body2" align="center" sx={{ color: '#ccc', mb: 2 }}>
            Pedidos, cocina, cuenta y administración en un solo ecosistema.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 2, flexWrap: 'wrap' }}>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Términos</a>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Privacidad</a>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Contacto</a>
          </Box>
          <Typography variant="caption" align="center" sx={{ color: '#999', display: 'block', mt: 2 }}>
            © {new Date().getFullYear()} MozoQR. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}
