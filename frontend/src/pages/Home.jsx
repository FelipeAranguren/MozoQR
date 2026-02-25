//src/pages/Home.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Container, Typography, Button, Grid, Card, Box, List, ListItem, ListItemIcon, ListItemText } from '@mui/material'
import QrCodeIcon from '@mui/icons-material/QrCode'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import BarChartIcon from '@mui/icons-material/BarChart'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import StarIcon from '@mui/icons-material/Star'
import heroImage from '../assets/hero-image.jpg'
import { MARANA_COLORS } from '../theme'

export default function Home() {
  const navigate = useNavigate()

  const features = [
    {
      icon: <QrCodeIcon sx={{ fontSize: 40 }} />,
      title: 'Sin contacto',
      desc: 'Los clientes escanean un QR y ordenan desde su celular. Experiencia segura e instantánea.',
      color: '#2196F3'
    },
    {
      icon: <SmartphoneIcon sx={{ fontSize: 40 }} />,
      title: 'Experiencia moderna',
      desc: 'Interfaz intuitiva diseñada para todas las edades. Pedidos en 3 clics.',
      color: '#9C27B0'
    },
    {
      icon: <CreditCardIcon sx={{ fontSize: 40 }} />,
      title: 'Pagos digitales',
      desc: 'Múltiples métodos de pago integrados y seguros. Sin efectivo, sin complicaciones.',
      color: '#4CAF50'
    },
    {
      icon: <BarChartIcon sx={{ fontSize: 40 }} />,
      title: 'Análisis en tiempo real',
      desc: 'Dashboard con métricas de ventas y productos populares. Toma decisiones basadas en datos.',
      color: '#FF9800'
    }
  ]

  const benefits = [
    { text: 'Reduce el tiempo de espera hasta un 60%', stat: '60%' },
    { text: 'Aumenta el ticket promedio por mesa', stat: '+35%' },
    { text: 'Libera personal para atención personalizada', stat: '2x' },
    { text: 'Elimina errores en los pedidos', stat: '99%' },
    { text: 'Configuración en menos de 24 horas', stat: '<24h' },
    { text: 'Obtén datos valiosos sobre preferencias', stat: '100%' }
  ]

  // Planes (misma estructura y beneficios que OwnerDashboard PlanComparison)
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
      ],
      cta: 'Comenzar gratis',
      ctaAction: () => navigate('/demo')
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
      ],
      cta: 'Contactar ventas',
      ctaAction: () => window.location.href = 'mailto:ventas@mozoqr.com'
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
      limitations: [],
      cta: 'Contactar ventas',
      ctaAction: () => window.location.href = 'mailto:ventas@mozoqr.com'
    }
  }

  const testimonials = [
    {
      name: 'Javier Taussig',
      role: 'Dueño de La Parrilla Tuvi',
      content: 'MozoQR transformó nuestro restaurante. Los clientes están más contentos y nuestras ventas aumentaron un 40% en el primer mes.',
      rating: 5
    },
    {
      name: 'Francisco Godino',
      role: 'Gerente de Pizzería Italiana',
      content: 'La mejor inversión que hemos hecho. El tiempo de servicio se redujo a la mitad y el personal puede enfocarse en la calidad.',
      rating: 5
    },
    {
      name: 'Javier Basombrio',
      role: 'Fundador de Cafe Prime',
      content: 'Increíblemente fácil de usar. Nuestros clientes aman la experiencia y nosotros amamos los datos que obtenemos.',
      rating: 5
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
    <div>
      {/* Hero Section */}
      <Box sx={{
        py: { xs: 6, md: 12 },
        background: 'linear-gradient(to bottom right, #e0f2f1, #ffffff)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      display: 'inline-block',
                      px: 2,
                      py: 1,
                      bgcolor: 'primary.50',
                      color: 'primary.700',
                      borderRadius: '20px',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  >
                    🚀 La solución #1 para restaurantes
                  </Typography>
                </Box>

                <Typography
                  variant="h2"
                  fontWeight="bold"
                  gutterBottom
                  sx={{
                    fontSize: { xs: '2rem', md: '3rem', lg: '3.5rem' },
                    lineHeight: 1.2
                  }}
                >
                  Moderniza tu{' '}
                  <span style={{ color: '#00796B' }}>restaurante</span>
                  <br />
                  en minutos
                </Typography>

                <Typography
                  variant="h6"
                  color="textSecondary"
                  paragraph
                  sx={{
                    fontSize: { xs: '1rem', md: '1.25rem' },
                    mt: 2,
                    mb: 3,
                    lineHeight: 1.6
                  }}
                >
                  Transforma la experiencia de tus clientes con pedidos digitales, pagos instantáneos y análisis en tiempo real.{' '}
                  <strong style={{ color: '#212121' }}>Aumenta tus ventas mientras reduces costos.</strong>
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => navigate('/demo')}
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        px: 4,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        boxShadow: 3,
                        '&:hover': {
                          boxShadow: 6
                        }
                      }}
                    >
                      Probar gratis ahora
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
                        px: 4,
                        py: 1.5,
                        fontSize: '1rem',
                        fontWeight: 600,
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2
                        }
                      }}
                    >
                      Contactar Ventas
                    </Button>
                  </motion.div>
                </Box>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight="bold" color="text.primary">
                        +500
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Restaurantes
                      </Typography>
                    </Box>
                    <Box sx={{ width: '1px', height: '48px', bgcolor: 'divider' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight="bold" color="text.primary">
                        99%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Satisfacción
                      </Typography>
                    </Box>
                    <Box sx={{ width: '1px', height: '48px', bgcolor: 'divider' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight="bold" color="text.primary">
                        24h
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Configuración
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={6}>
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
                        left: -24,
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
                            En 30 segundos
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </motion.div>
                </Box>
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
              Todo lo que necesitas en{' '}
              <span style={{ color: '#00796B' }}>una plataforma</span>
            </Typography>
            <Typography variant="subtitle1" align="center" color="textSecondary" paragraph sx={{ mb: 4 }}>
              Funcionalidades diseñadas para aumentar tus ventas y mejorar la experiencia de tus clientes
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
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#ffffff' }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
              Planes que se adaptan a tu{' '}
              <span style={{ color: '#00796B' }}>negocio</span>
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
                        <Typography variant="h4" fontWeight="bold" sx={{ color: planData.color, mb: 2 }}>
                          {planData.price}
                        </Typography>

                        <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>
                          Incluye:
                        </Typography>
                        <List dense sx={{ mb: planData.limitations?.length ? 2 : 3, flex: 1 }}>
                          {planData.features.map((feature, idx) => (
                            <ListItem key={idx} sx={{ py: 0.25, px: 0 }}>
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <CheckIcon sx={{ color: '#00796B', fontSize: 18 }} />
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
                  Resultados que{' '}
                  <span style={{ color: '#00796B' }}>hablan por sí solos</span>
                </Typography>
                <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 4 }}>
                  Miles de restaurantes ya están transformando su negocio con MozoQR.
                  Únete a la revolución digital y comienza a ver resultados desde el primer día.
                </Typography>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  <Box sx={{ mt: 2 }}>
                    {benefits.map((b, i) => (
                      <motion.div
                        key={i}
                        variants={itemVariants}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                            <CheckCircleIcon color="success" />
                            <Typography variant="body1" fontWeight={500}>
                              {b.text}
                            </Typography>
                          </Box>
                          <Typography
                            variant="h5"
                            fontWeight="bold"
                            sx={{ color: 'primary.main', minWidth: '60px', textAlign: 'right' }}
                          >
                            {b.stat}
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
                    Configuración en menos de 24 horas. Sin instalación, sin hardware adicional.
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

      {/* Testimonials Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#f9f9f9' }}>
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
              Lo que dicen nuestros{' '}
              <span style={{ color: '#00796B' }}>clientes</span>
            </Typography>
            <Typography variant="subtitle1" align="center" color="textSecondary" paragraph sx={{ mb: 4 }}>
              Miles de restaurantes confían en MozoQR para transformar su negocio
            </Typography>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Grid container spacing={4}>
              {testimonials.map((testimonial, index) => (
                <Grid item xs={12} md={4} key={index}>
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
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-8px)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <StarIcon key={i} sx={{ color: '#FFC107', fontSize: 20 }} />
                        ))}
                      </Box>
                      <Typography
                        variant="body1"
                        color="textSecondary"
                        paragraph
                        sx={{
                          fontStyle: 'italic',
                          flex: 1,
                          mb: 2
                        }}
                      >
                        "{testimonial.content}"
                      </Typography>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {testimonial.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {testimonial.role}
                        </Typography>
                      </Box>
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
        background: 'linear-gradient(to bottom right, #00796B, #004D40)',
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
                  ¿Listo para transformar tu restaurante?
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
                  Únete a cientos de restaurantes que ya están aumentando sus ventas y mejorando
                  la experiencia de sus clientes con MozoQR.
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
            Transformando la experiencia gastronómica, una mesa a la vez.
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
    </div>
  )
}
