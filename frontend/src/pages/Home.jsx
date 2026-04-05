import React, { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import {
  Container, Typography, Button, Grid, Box, List, ListItem,
  ListItemIcon, ListItemText, CircularProgress, Stack, Chip,
} from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import BarChartIcon from '@mui/icons-material/BarChart'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import StarIcon from '@mui/icons-material/Star'
import { alpha } from '@mui/material/styles'
import { COLORS } from '../theme'
import { useDolarBlue } from '../hooks/useDolarBlue'
import { PLAN_BASE_USD, formatPriceARS, formatPriceUSD } from '../constants/planPricing'
import QrStarfieldHero from '../components/QrStarfieldHero'

function FadeIn({ children, delay = 0, style }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { blueVenta, loading: dolarLoading } = useDolarBlue()

  const heroTarget = useMotionValue(0)
  const heroProgress = useSpring(heroTarget, { stiffness: 28, damping: 16 })

  useEffect(() => {
    const timer = setTimeout(() => heroTarget.set(1), 300)
    return () => clearTimeout(timer)
  }, [heroTarget])

  const steps = [
    {
      num: '01',
      icon: <QrCodeScannerIcon sx={{ fontSize: 28, color: COLORS.secondary }} />,
      title: 'El cliente escanea el QR',
      desc: 'Abre el menú desde su celular, arma el pedido y lo envía. Sin esperar al mozo.',
    },
    {
      num: '02',
      icon: <RestaurantMenuIcon sx={{ fontSize: 28, color: COLORS.secondary }} />,
      title: 'Cocina y sala reciben al instante',
      desc: 'Los pedidos llegan en tiempo real. El equipo sabe qué preparar y qué servir sin papeles.',
    },
    {
      num: '03',
      icon: <BarChartIcon sx={{ fontSize: 28, color: COLORS.secondary }} />,
      title: 'El dueño controla todo',
      desc: 'Ventas, mesas, cuentas y reportes en un solo panel. Con IA en planes avanzados.',
    },
  ]

  const plans = {
    BASIC: {
      name: 'Básico', priceUsd: PLAN_BASE_USD.BASIC, description: 'Control operacional esencial',
      highlight: false, badge: null,
      features: [
        'KPIs básicos (ventas, pedidos, ticket promedio)',
        'Estado de mesas en tiempo real',
        'Gestión de productos, categorías y mesas',
        'Logo y colores personalizados',
        'Actividad reciente e insights simples',
      ],
      limitations: ['Sin análisis avanzados ni predicciones', 'Sin exportaciones ni múltiples sucursales'],
      cta: 'Elegir plan', ctaAction: () => navigate('/checkout?plan=basic'),
    },
    PRO: {
      name: 'Pro', priceUsd: 80, description: 'Datos y análisis avanzados',
      highlight: false, badge: 'Popular',
      features: [
        'Todo lo de Básico',
        'Analytics avanzados y comparativas',
        'Top productos, horas pico, tendencias',
        'Predicciones de ventas y demanda',
        'Roles de personal y reporte de caja',
        'Historial de transacciones completo',
      ],
      limitations: ['Sin IA integrada ni múltiples sucursales'],
      cta: 'Elegir plan', ctaAction: () => navigate('/checkout?plan=pro'),
    },
    ULTRA: {
      name: 'Ultra', priceUsd: 100, description: 'Inteligencia y automatización total',
      highlight: true, badge: 'Mejor valor',
      features: [
        'Todo lo de Pro',
        'IA integrada: sugerencias de menú, combos, detección',
        'Análisis de rentabilidad completo',
        'Heatmap de horas pico y ranking de mesas',
        'Múltiples sucursales con panel consolidado',
        'Exportaciones CSV/PDF y auditorías',
        'Pagos online integrados',
      ],
      limitations: [],
      cta: 'Comenzar con Ultra', ctaAction: () => navigate('/checkout?plan=ultra'),
    },
  }

  return (
    <Box component="main" sx={{ overflowX: 'hidden', width: '100%' }}>

      {/* ─── HERO ─────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: '100vh', md: '100vh' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          bgcolor: '#000',
        }}
      >
        <QrStarfieldHero progress={heroProgress} />

        {/* Dark vignette for text readability */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        <Container sx={{ position: 'relative', zIndex: 2, textAlign: 'center', py: { xs: 10, md: 14 } }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '3.5rem', sm: '4.5rem', md: '6rem' },
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
                color: '#fff',
                mb: 3,
                textShadow: '0 2px 40px rgba(0,0,0,0.6), 0 8px 80px rgba(0,0,0,0.4)',
              }}
            >
              MozoQR
            </Typography>

            <Typography
              sx={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: { xs: '1.05rem', md: '1.3rem' },
                lineHeight: 1.65,
                maxWidth: 500,
                mx: 'auto',
                mb: 5,
                fontWeight: 400,
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              }}
            >
              Pedidos desde la mesa, cocina en tiempo real y control total para el dueño.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/demo')}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  bgcolor: '#fff',
                  color: '#000',
                  px: 4.5,
                  py: 1.75,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  borderRadius: 2.5,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  '&:hover': { bgcolor: '#f0f0f0' },
                }}
              >
                Probar demo gratis
              </Button>
              <Button
                size="large"
                onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  bgcolor: 'transparent',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  color: '#fff',
                  px: 4.5,
                  py: 1.75,
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  borderRadius: 2.5,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                Ver planes
              </Button>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* ─── CÓMO FUNCIONA ────────────────────────────── */}
      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: COLORS.bg }}>
        <Container>
          <FadeIn>
            <Typography
              variant="overline"
              display="block"
              align="center"
              sx={{ color: COLORS.secondary, fontWeight: 700, letterSpacing: 2, mb: 1 }}
            >
              Cómo funciona
            </Typography>
            <Typography
              variant="h3"
              align="center"
              fontWeight={800}
              sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, mb: 1.5, letterSpacing: '-0.02em' }}
            >
              Tres pasos, un solo flujo
            </Typography>
            <Typography
              variant="body1"
              align="center"
              color="textSecondary"
              sx={{ maxWidth: 480, mx: 'auto', mb: { xs: 5, md: 6 }, lineHeight: 1.7 }}
            >
              Del comensal a la cocina y del reporte al dueño, sin fricción.
            </Typography>
          </FadeIn>

          <Grid container spacing={{ xs: 2, md: 3 }}>
            {steps.map((step, i) => (
              <Grid item xs={12} md={4} key={step.num}>
                <FadeIn delay={i * 0.1} style={{ height: '100%' }}>
                  <Box
                    sx={{
                      p: { xs: 3, md: 3.5 },
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: COLORS.border,
                      bgcolor: COLORS.surface,
                      height: '100%',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      '&:hover': { borderColor: COLORS.secondary, boxShadow: `0 8px 24px ${alpha(COLORS.secondary, 0.08)}` },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: alpha(COLORS.secondary, 0.08),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2.5,
                      }}
                    >
                      {step.icon}
                    </Box>
                    <Typography
                      variant="overline"
                      sx={{ color: COLORS.textMuted, fontWeight: 700, letterSpacing: 1.5 }}
                    >
                      Paso {step.num}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, mb: 1 }}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.7 }}>
                      {step.desc}
                    </Typography>
                  </Box>
                </FadeIn>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── PLANES ───────────────────────────────────── */}
      <Box id="planes" sx={{ py: { xs: 7, md: 10 }, bgcolor: COLORS.surface }}>
        <Container>
          <FadeIn>
            <Typography
              variant="overline"
              display="block"
              align="center"
              sx={{ color: COLORS.secondary, fontWeight: 700, letterSpacing: 2, mb: 1 }}
            >
              Precios
            </Typography>
            <Typography
              variant="h3"
              align="center"
              fontWeight={800}
              sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' }, mb: 1.5, letterSpacing: '-0.02em' }}
            >
              Planes para cada restaurante
            </Typography>
            <Typography
              variant="body1"
              align="center"
              color="textSecondary"
              sx={{ maxWidth: 460, mx: 'auto', mb: { xs: 5, md: 6 }, lineHeight: 1.7 }}
            >
              Empezá gratis y escalá cuando lo necesités. Sin compromisos.
            </Typography>
          </FadeIn>

          <Grid container spacing={3} alignItems="stretch">
            {Object.entries(plans).map(([key, plan], i) => {
              const isUltra = plan.highlight
              return (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <FadeIn delay={i * 0.08} style={{ height: '100%' }}>
                    <Box
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        overflow: 'hidden',
                        position: 'relative',
                        ...(isUltra
                          ? {
                              background: `linear-gradient(155deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 60%, ${alpha(COLORS.secondary, 0.7)} 140%)`,
                              boxShadow: `0 24px 64px ${alpha(COLORS.primary, 0.3)}`,
                            }
                          : {
                              border: '1px solid',
                              borderColor: COLORS.border,
                              bgcolor: COLORS.surface,
                              transition: 'border-color 0.2s, box-shadow 0.2s',
                              '&:hover': { borderColor: COLORS.borderStrong, boxShadow: COLORS.shadow3 },
                            }),
                      }}
                    >
                      <Box sx={{ p: { xs: 3, md: 3.5 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="h5" fontWeight={800} sx={{ color: isUltra ? '#fff' : COLORS.text }}>
                            {plan.name}
                          </Typography>
                          {plan.badge && (
                            <Chip
                              label={plan.badge}
                              size="small"
                              icon={isUltra ? <StarIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} /> : undefined}
                              sx={{
                                fontWeight: 700, fontSize: '0.7rem', height: 26,
                                ...(isUltra
                                  ? { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }
                                  : { bgcolor: alpha(COLORS.secondary, 0.1), color: COLORS.secondary }),
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ color: isUltra ? 'rgba(255,255,255,0.65)' : COLORS.textSecondary, mb: 2.5 }}>
                          {plan.description}
                        </Typography>

                        <Box sx={{ mb: 2.5 }}>
                          {dolarLoading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={20} sx={{ color: isUltra ? '#fff' : COLORS.textMuted }} />
                              <Typography variant="body2" sx={{ color: isUltra ? 'rgba(255,255,255,0.6)' : COLORS.textSecondary }}>
                                Cargando...
                              </Typography>
                            </Box>
                          ) : (
                            <>
                              <Typography variant="h3" fontWeight={800} sx={{ color: isUltra ? '#fff' : COLORS.text, lineHeight: 1 }}>
                                {formatPriceARS(plan.priceUsd * blueVenta)}
                                <Typography component="span" variant="body2" fontWeight={500} sx={{ ml: 0.5, color: isUltra ? 'rgba(255,255,255,0.5)' : COLORS.textMuted }}>
                                  /mes
                                </Typography>
                              </Typography>
                              <Typography variant="caption" sx={{ color: isUltra ? 'rgba(255,255,255,0.4)' : COLORS.textMuted, mt: 0.5, display: 'block' }}>
                                ({formatPriceUSD(plan.priceUsd)})
                              </Typography>
                            </>
                          )}
                        </Box>

                        <Box sx={{ mb: 2, height: 1, bgcolor: isUltra ? 'rgba(255,255,255,0.12)' : COLORS.border }} />

                        <List dense disablePadding sx={{ mb: plan.limitations?.length ? 1.5 : 'auto', flex: plan.limitations?.length ? 'none' : 1 }}>
                          {plan.features.map((f, idx) => (
                            <ListItem key={idx} disableGutters sx={{ py: 0.25, alignItems: 'flex-start' }}>
                              <ListItemIcon sx={{ minWidth: 24, mt: 0.3 }}>
                                <CheckIcon sx={{ fontSize: 15, color: isUltra ? COLORS.secondaryLight : COLORS.secondary }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={f}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  sx: { fontSize: '0.8125rem', lineHeight: 1.5, color: isUltra ? 'rgba(255,255,255,0.85)' : COLORS.text },
                                }}
                              />
                            </ListItem>
                          ))}
                        </List>

                        {plan.limitations?.length > 0 && (
                          <List dense disablePadding sx={{ mb: 2.5, flex: 1 }}>
                            {plan.limitations.map((l, idx) => (
                              <ListItem key={idx} disableGutters sx={{ py: 0.25, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth: 24, mt: 0.3 }}>
                                  <CloseIcon sx={{ fontSize: 14, color: isUltra ? 'rgba(255,255,255,0.3)' : COLORS.textMuted }} />
                                </ListItemIcon>
                                <ListItemText
                                  primary={l}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    sx: { fontSize: '0.8125rem', color: isUltra ? 'rgba(255,255,255,0.5)' : COLORS.textMuted },
                                  }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}

                        <Box sx={{ mt: 'auto' }}>
                          <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={plan.ctaAction}
                            sx={{
                              py: 1.5, fontWeight: 700, borderRadius: 2, fontSize: '0.9375rem',
                              ...(isUltra
                                ? { bgcolor: '#fff', color: COLORS.primaryDark, '&:hover': { bgcolor: '#f0f0f0' } }
                                : { bgcolor: COLORS.primary, color: '#fff', '&:hover': { bgcolor: COLORS.primaryLight } }),
                            }}
                          >
                            {plan.cta}
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </FadeIn>
                </Grid>
              )
            })}
          </Grid>

          <FadeIn delay={0.2}>
            <Typography variant="caption" display="block" sx={{ mt: 3, textAlign: 'center', color: COLORS.textMuted }}>
              Cotización dólar blue: {formatPriceARS(blueVenta)}
            </Typography>
          </FadeIn>
        </Container>
      </Box>

      {/* ─── CTA FINAL + FOOTER ───────────────────────── */}
      <Box sx={{ bgcolor: COLORS.primaryDark, color: '#fff', py: { xs: 6, md: 8 } }}>
        <Container>
          <Box sx={{ maxWidth: 560, mx: 'auto', textAlign: 'center' }}>
            <FadeIn>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 1.5, letterSpacing: '-0.02em' }}
              >
                Probalo con datos de ejemplo
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', mb: 4, lineHeight: 1.7 }}>
                Recorré la demo como comensal, cocina o dueño. Sin tarjeta, sin compromiso.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mb: 5 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/demo')}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#fff', color: COLORS.primaryDark, px: 4, py: 1.5,
                    fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#f0f0f0' },
                  }}
                >
                  Empezar demo
                </Button>
                <Button
                  size="large"
                  href="mailto:ventas@mozoqr.com"
                  sx={{
                    bgcolor: 'transparent',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    px: 4, py: 1.5, fontWeight: 600, borderRadius: 2,
                    '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.06)' },
                  }}
                >
                  Contactar ventas
                </Button>
              </Stack>
            </FadeIn>

            <Box sx={{ pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>MozoQR</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block', mb: 1.5 }}>
                Pedidos, cocina y administración en un solo sistema.
              </Typography>
              <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 1.5 }}>
                {['Términos', 'Privacidad', 'Contacto'].map((link) => (
                  <Box key={link} component="a" href="#" sx={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '0.8125rem', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}>
                    {link}
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)' }}>
                © {new Date().getFullYear()} MozoQR
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
