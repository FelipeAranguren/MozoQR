//src/pages/Home.jsx — REDESIGNED
// All logic, routes, data imports preserved. Only UI/animations changed.
import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from 'framer-motion'
import {
  Container, Typography, Button, Grid, Card, Box, List, ListItem,
  ListItemIcon, ListItemText, CircularProgress, Stack, Paper, useTheme, Chip
} from '@mui/material'
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
import BoltIcon from '@mui/icons-material/Bolt'
import StarIcon from '@mui/icons-material/Star'
import { alpha } from '@mui/material/styles'
import { MARANA_COLORS } from '../theme'
import { useDolarBlue } from '../hooks/useDolarBlue'
import { formatPriceARS, formatPriceUSD } from '../constants/planPricing'

// ─── QR Matrix 20x21 (simplified real QR pattern) ────────────────────────────
const QR_MATRIX = [
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,0,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0],
  [1,0,1,1,0,0,1,0,0,0,1,0,0,0,1,1,0,1,0,1,0],
  [0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,1,0,0,1,1],
  [1,0,1,0,1,1,1,0,0,1,1,0,1,0,1,0,0,1,1,0,1],
  [0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0],
  [1,1,1,0,1,0,1,0,0,1,0,1,0,0,1,1,1,0,1,1,1],
  [0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,0,0,0,1,0,0,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,1,0,0,1,1,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,1,1,1,1],
]
const QR_CELLS = []
QR_MATRIX.forEach((row, r) => row.forEach((val, c) => {
  if (val === 1) QR_CELLS.push({ r, c, id: r * 21 + c })
}))

// ─── Animated QR ─────────────────────────────────────────────────────────────
function AnimatedQR() {
  const theme = useTheme()
  const sz = 13, gap = 1, total = QR_CELLS.length
  return (
    <Box sx={{ position: 'relative', width: 21*(sz+gap), height: 20*(sz+gap), mx: 'auto' }}>
      {QR_CELLS.map((cell, idx) => (
        <motion.div
          key={cell.id}
          initial={{ opacity: 0, scale: 0, x: (Math.random()-0.5)*110, y: (Math.random()-0.5)*110 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          transition={{ duration: 0.5, delay: (idx/total)*0.85, ease: [0.22,1,0.36,1] }}
          style={{
            position: 'absolute',
            left: cell.c*(sz+gap), top: cell.r*(sz+gap),
            width: sz, height: sz, borderRadius: 2,
            background: theme.palette.primary.main
          }}
        />
      ))}
    </Box>
  )
}

// ─── Scroll-triggered fade wrapper ───────────────────────────────────────────
function FadeSection({ children, delay=0, direction='up' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const yMap={up:40,down:-40,left:0,right:0}, xMap={left:-40,right:40,up:0,down:0}
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, y:yMap[direction], x:xMap[direction] }}
      animate={inView ? { opacity:1, y:0, x:0 } : {}}
      transition={{ duration:0.65, delay, ease:[0.22,1,0.36,1] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Pill badge ───────────────────────────────────────────────────────────────
function PillBadge({ children, color }) {
  return (
    <Box component="span" sx={{
      display:'inline-flex', alignItems:'center', px:1.5, py:0.4,
      borderRadius:10, fontSize:'0.72rem', fontWeight:700, letterSpacing:0.8, textTransform:'uppercase',
      bgcolor: alpha(color, 0.12), color, border:`1px solid ${alpha(color, 0.25)}`
    }}>
      {children}
    </Box>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const theme = useTheme()
  const { blueVenta, loading: dolarLoading } = useDolarBlue()

  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start','end start'] })
  const smooth = useSpring(scrollYProgress, { stiffness:80, damping:20 })
  const heroY = useTransform(smooth, [0,1], [0,-80])
  const heroOpacity = useTransform(smooth, [0,0.6], [1,0])
  const qrScale = useTransform(smooth, [0,0.4], [1,0.85])

  const [qrReady, setQrReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setQrReady(true), 350); return () => clearTimeout(t) }, [])

  // ── Shared variants
  const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.09 } } }
  const fadeUp = {
    hidden:{ opacity:0, y:28 },
    visible:{ opacity:1, y:0, transition:{ duration:0.55, ease:[0.22,1,0.36,1] } }
  }
  const scaleIn = {
    hidden:{ opacity:0, scale:0.88 },
    visible:{ opacity:1, scale:1, transition:{ duration:0.5, ease:[0.22,1,0.36,1] } }
  }

  // ── Data (unchanged logic, same structure) ────────────────────────────────
  const features = [
    { icon:<QrCodeIcon sx={{fontSize:36}}/>, title:'Pedidos desde la mesa', desc:'El comensal abre el menú con QR, inicia una cuenta y envía pedidos al instante a cocina y sala.', color:'#2196F3' },
    { icon:<KitchenIcon sx={{fontSize:36}}/>, title:'Cocina y mozos alineados', desc:'Pedidos en tiempo real: menos idas y vueltas, más claridad entre mesa, barra y cocina.', color:'#009688' },
    { icon:<ReceiptLongIcon sx={{fontSize:36}}/>, title:'Cuenta de mesa automática', desc:'Todo lo pedido en una sola cuenta digital: cierre sin confusiones y pago sin pedir la cuenta.', color:'#4CAF50' },
    { icon:<InsightsIcon sx={{fontSize:36}}/>, title:'Dueño: operación y finanzas', desc:'Estadísticas, facturación, historial y una IA que sugiere ajustes para ordenar tu negocio.', color:'#FF9800' },
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
    { title:'En el salón', subtitle:'Experiencia del comensal', body:'Escanea, arma su pedido en una cuenta vinculada a la mesa y puede pagar cuando quiera, sin fricción extra al cerrar.', num:'01', color:theme.palette.primary.main },
    { title:'En cocina y piso', subtitle:'Operación del día a día', body:'Los pedidos entran en tiempo real; el equipo ve qué cocinar y qué servir sin depender de papelitos sueltos o mensajes cruzados.', num:'02', color: theme.palette.secondary?.main || '#009688' },
    { title:'En la oficina', subtitle:'Control del dueño', body:'Facturas, picos de demanda y reportes en un panel pensado para decidir con información, más recomendaciones de IA cuando tu plan lo incluye.', num:'03', color:'#2E7D32' },
  ]

  const plans = {
    BASIC: {
      name:'Básico', priceUsd:0.0007, description:'Control operacional esencial',
      color:MARANA_COLORS.textSecondary, highlight:false, badge:null,
      features:['KPIs básicos (ventas diarias, pedidos, ticket promedio)','Vista rápida de mesas (estado, pedidos activos)','Gestión básica (CRUD productos, categorías, mesas)','Disponibilidad de productos','Editar logo y colores','Actividad reciente (últimos pedidos, cuentas pagadas)','Insights simples (top productos, horas pico)'],
      limitations:['Sin análisis avanzados','Sin predicciones','Sin comparativas semanales','Sin exportaciones','Sin múltiples sucursales'],
      cta:'Elegir plan', ctaAction:() => navigate('/checkout?plan=basic')
    },
    PRO: {
      name:'Pro', priceUsd:80, description:'Optimización con datos y análisis avanzados',
      color:MARANA_COLORS.secondary, highlight:false, badge:'Popular',
      features:['Todo lo de Básico','Analytics avanzados (ventas semanales, tendencias)','Top 5 productos del mes','Comparativa HOY vs AYER','Horas pico del negocio','Productos frecuentemente sin stock','Predicciones simples (ventas diarias, demanda)','Health Check completo','Roles de personal','Reporte diario de caja','Historial de transacciones','Notificaciones de stock bajo','Análisis de rentabilidad básico','Comparativas semanales/mensuales'],
      limitations:['Sin IA integrada','Sin múltiples sucursales','Sin exportaciones avanzadas','Sin análisis de estacionalidad'],
      cta:'Elegir plan', ctaAction:() => navigate('/checkout?plan=pro')
    },
    ULTRA: {
      name:'Ultra', priceUsd:100, description:'Inteligencia y automatización total',
      color:theme.palette.primary.main, highlight:true, badge:'Mejor valor',
      features:['Todo lo de Pro','Análisis de rentabilidad completo (márgenes, productos más/menos rentables)','Ranking de mesas más rentables','Tiempos promedio de preparación','Tiempo promedio de ocupación de mesas','Heatmap de horas pico','Comparación entre sucursales','Funnel de clientes','Panel Profit Optimizer','IA integrada (sugerencias de menú, combos, detección de productos)','Análisis de estacionalidad','Múltiples sucursales','Panel consolidado','Exportaciones CSV/PDF','Auditorías completas','Logs de usuario','Sistema de tareas','Integración de pagos online','Suscripciones y facturación','Vista Operativa vs Ejecutiva'],
      limitations:[],
      cta:'Comenzar con Ultra', ctaAction:() => navigate('/checkout?plan=ultra')
    }
  }

  const heroHighlights = [
    { title:'Tiempo real', subtitle:'Pedidos visibles en cocina y sala al momento.', icon:<SyncAltIcon sx={{fontSize:24}}/>, color:theme.palette.primary.main },
    { title:'Una cuenta', subtitle:'Todo lo pedido en la mesa, en un solo lugar.', icon:<TableRestaurantIcon sx={{fontSize:24}}/>, color:theme.palette.secondary?.main || theme.palette.primary.main },
    { title:'Pagos digitales', subtitle:'Cerrar sin pedir la cuenta en voz alta.', icon:<PaymentsIcon sx={{fontSize:24}}/>, color:'#2E7D32' },
  ]

  return (
    <Box component="main" sx={{ overflowX:'hidden', width:'100%', maxWidth:'100%', minWidth:0 }}>

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <Box ref={heroRef} sx={{
        minHeight:'100vh', position:'relative', overflow:'hidden',
        display:'flex', alignItems:'center',
        background:`linear-gradient(135deg, #f0faf9 0%, #ffffff 55%, #e8f5e9 100%)`
      }}>
        {/* BG blobs + grid */}
        <Box sx={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
          <Box sx={{ position:'absolute', top:'-10%', right:'-5%', width:560, height:560, borderRadius:'50%', background:`radial-gradient(circle, ${alpha(theme.palette.primary.main,0.1)} 0%, transparent 65%)` }}/>
          <Box sx={{ position:'absolute', bottom:'5%', left:'-8%', width:420, height:420, borderRadius:'50%', background:`radial-gradient(circle, ${alpha('#009688',0.07)} 0%, transparent 65%)` }}/>
          <Box sx={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(${alpha(theme.palette.primary.main,0.04)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.primary.main,0.04)} 1px, transparent 1px)`, backgroundSize:'52px 52px' }}/>
        </Box>

        <motion.div style={{ y:heroY, opacity:heroOpacity, width:'100%', zIndex:1, position:'relative' }}>
          <Container sx={{ py:{ xs:8, md:6 } }}>
            <Grid container spacing={{ xs:6, md:8 }} alignItems="center">

              {/* Text col */}
              <Grid item xs={12} md={6} sx={{ order:{ xs:2, md:1 } }}>
                <motion.div initial="hidden" animate="visible" variants={stagger}>
                  <motion.div variants={fadeUp}>
                    <Box sx={{ mb:2 }}>
                      <PillBadge color={theme.palette.primary.main}>
                        <BoltIcon sx={{ fontSize:11, mr:0.4 }}/> Nuevo · Versión 2025
                      </PillBadge>
                    </Box>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <Typography variant="h1" fontWeight={800} sx={{ fontSize:{ xs:'2.1rem', sm:'2.6rem', md:'3.4rem', lg:'4rem' }, lineHeight:1.15, letterSpacing:'-0.02em', mb:2.5 }}>
                      Un solo sistema para{' '}
                      <Box component="span" sx={{ position:'relative', color:'primary.main',
                        '&::after':{ content:'""', position:'absolute', bottom:2, left:0, right:0, height:3, borderRadius:2, background:`linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main,0.3)})` }
                      }}>
                        mesa, cocina y finanzas
                      </Box>
                    </Typography>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <Typography color="textSecondary" sx={{ fontSize:{ xs:'1rem', md:'1.15rem' }, lineHeight:1.75, mb:4, maxWidth:500 }}>
                      MozoQR conecta la mesa con la cocina y el panel del dueño: pedidos desde la mesa, cuenta automática, pagos sin pedir la cuenta, y herramientas con IA.
                    </Typography>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ mb:5 }}>
                      <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
                        <Button variant="contained" size="large" onClick={() => navigate('/demo')} endIcon={<ArrowForwardIcon/>}
                          sx={{ py:1.6, px:3.5, fontSize:'1rem', fontWeight:700, borderRadius:2.5,
                            boxShadow:`0 8px 28px ${alpha(theme.palette.primary.main,0.35)}`,
                            '&:hover':{ boxShadow:`0 12px 36px ${alpha(theme.palette.primary.main,0.45)}` } }}>
                          Probar gratis ahora
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
                        <Button variant="outlined" size="large"
                          onClick={() => document.getElementById('planes')?.scrollIntoView({ behavior:'smooth' })}
                          sx={{ py:1.6, px:3, fontSize:'1rem', fontWeight:600, borderRadius:2.5, borderWidth:2, '&:hover':{ borderWidth:2 } }}>
                          Ver planes
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
                        <Button variant="text" size="large" href="mailto:ventas@mozoqr.com"
                          sx={{ py:1.6, px:2, fontSize:'1rem', fontWeight:600, borderRadius:2.5 }}>
                          Contactar ventas
                        </Button>
                      </motion.div>
                    </Stack>
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ rowGap:1 }}>
                      {['Sin tarjeta de crédito','Cancelación libre','Demo instantánea'].map(t => (
                        <Box key={t} sx={{ display:'flex', alignItems:'center', gap:0.6 }}>
                          <CheckCircleIcon sx={{ fontSize:16, color:'success.main' }}/>
                          <Typography variant="caption" color="textSecondary" fontWeight={500}>{t}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </motion.div>
                </motion.div>
              </Grid>

              {/* QR col */}
              <Grid item xs={12} md={6} sx={{ order:{ xs:1, md:2 }, display:'flex', justifyContent:'center' }}>
                <motion.div style={{ scale:qrScale }}>
                  <Box sx={{ position:'relative', display:'inline-block' }}>
                    <Box sx={{ position:'absolute', inset:-32, borderRadius:'50%',
                      background:`radial-gradient(circle, ${alpha(theme.palette.primary.main,0.13)} 0%, transparent 70%)`,
                      animation:'pulse 3s ease-in-out infinite',
                      '@keyframes pulse':{ '0%,100%':{ transform:'scale(1)', opacity:0.9 }, '50%':{ transform:'scale(1.08)', opacity:0.5 } }
                    }}/>
                    <Paper elevation={0} sx={{
                      p:{ xs:3, md:4 }, borderRadius:4,
                      border:`1px solid ${alpha(theme.palette.primary.main,0.15)}`,
                      bgcolor:'rgba(255,255,255,0.92)', backdropFilter:'blur(16px)',
                      boxShadow:`0 24px 64px ${alpha(theme.palette.primary.main,0.12)}, 0 4px 16px rgba(0,0,0,0.06)`,
                      position:'relative', zIndex:1
                    }}>
                      <Typography variant="overline" sx={{ display:'block', textAlign:'center', mb:2, color:'primary.main', fontWeight:700, letterSpacing:2 }}>
                        Escaneá para pedir
                      </Typography>
                      {qrReady && <AnimatedQR/>}
                      <Box sx={{ mt:3, p:1.5, borderRadius:2, bgcolor:alpha(theme.palette.success.main,0.07), border:`1px solid ${alpha(theme.palette.success.main,0.2)}`, display:'flex', alignItems:'center', gap:1.5 }}>
                        <Box sx={{ width:34, height:34, borderRadius:'50%', bgcolor:alpha(theme.palette.success.main,0.15), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <CheckCircleIcon sx={{ color:'success.main', fontSize:20 }}/>
                        </Box>
                        <Box>
                          <Typography variant="caption" fontWeight={700} display="block">Pedido confirmado</Typography>
                          <Typography variant="caption" color="textSecondary">Visible en cocina al instante</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Box>
                </motion.div>
              </Grid>
            </Grid>

            {/* Highlight cards */}
            <Box sx={{ mt:{ xs:6, md:8 } }}>
              <motion.div initial="hidden" animate="visible" variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.1, delayChildren:0.5 } } }}>
                <Grid container spacing={2.5}>
                  {heroHighlights.map(h => (
                    <Grid item xs={12} sm={4} key={h.title}>
                      <motion.div variants={scaleIn} whileHover={{ y:-6, transition:{ duration:0.25 } }}>
                        <Paper elevation={0} sx={{
                          p:2.5, borderRadius:3, border:'1px solid', borderColor:'divider',
                          bgcolor:'rgba(255,255,255,0.8)', backdropFilter:'blur(12px)',
                          display:'flex', gap:2, alignItems:'flex-start',
                          transition:'box-shadow 0.25s, border-color 0.25s',
                          '&:hover':{ boxShadow:`0 12px 32px ${alpha(h.color,0.15)}`, borderColor:alpha(h.color,0.4) }
                        }}>
                          <Box sx={{ width:46, height:46, borderRadius:2, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:h.color, bgcolor:alpha(h.color,0.1) }}>
                            {h.icon}
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mb:0.3 }}>{h.title}</Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ lineHeight:1.55 }}>{h.subtitle}</Typography>
                          </Box>
                        </Paper>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </motion.div>
            </Box>
          </Container>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div animate={{ y:[0,8,0] }} transition={{ repeat:Infinity, duration:1.8, ease:'easeInOut' }}
          style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', zIndex:2 }}>
          <Box sx={{ width:28, height:46, borderRadius:14, border:`2px solid ${alpha(theme.palette.primary.main,0.35)}`, display:'flex', justifyContent:'center', pt:1 }}>
            <Box sx={{ width:4, height:10, borderRadius:2, bgcolor:alpha(theme.palette.primary.main,0.5) }}/>
          </Box>
        </motion.div>
      </Box>

      {/* ─── FEATURES ──────────────────────────────────────────────────── */}
      <Box sx={{ py:{ xs:10, md:14 }, bgcolor:'#f7faf9' }}>
        <Container>
          <FadeSection>
            <Typography variant="overline" display="block" align="center" sx={{ color:'primary.main', fontWeight:700, letterSpacing:2, mb:1.5 }}>Funcionalidades</Typography>
            <Typography variant="h3" align="center" fontWeight={800} sx={{ fontSize:{ xs:'1.85rem', md:'2.6rem' }, mb:1.5 }}>
              De la mesa al dueño, <Box component="span" sx={{ color:'primary.main' }}>sin saltos</Box>
            </Typography>
            <Typography variant="body1" align="center" color="textSecondary" sx={{ maxWidth:560, mx:'auto', mb:7, lineHeight:1.75 }}>
              Un mismo recorrido para quien come, quien cocina y quien administra: menos fricción operativa y más claridad financiera.
            </Typography>
          </FadeSection>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-60px' }} variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.1 } } }}>
            <Grid container spacing={3}>
              {features.map((f,i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <motion.div variants={scaleIn} whileHover={{ y:-10, transition:{ duration:0.28 } }} style={{ height:'100%' }}>
                    <Card elevation={0} sx={{
                      p:3.5, height:'100%', display:'flex', flexDirection:'column', borderRadius:3.5,
                      border:'1px solid', borderColor:'divider', bgcolor:'#fff',
                      transition:'box-shadow 0.3s, border-color 0.3s',
                      '&:hover':{ boxShadow:`0 20px 48px ${alpha(f.color,0.18)}`, borderColor:alpha(f.color,0.35) }
                    }}>
                      <Box sx={{ width:60, height:60, borderRadius:2.5, mb:2.5, display:'flex', alignItems:'center', justifyContent:'center', color:f.color, bgcolor:alpha(f.color,0.1) }}>
                        {f.icon}
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom>{f.title}</Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ lineHeight:1.7 }}>{f.desc}</Typography>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* ─── PLANS ─────────────────────────────────────────────────────── */}
      <Box id="planes" sx={{ py:{ xs:10, md:14 }, bgcolor:'#ffffff', position:'relative', overflow:'hidden' }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:800, height:800, borderRadius:'50%', pointerEvents:'none', background:`radial-gradient(circle, ${alpha(theme.palette.primary.main,0.04)} 0%, transparent 65%)` }}/>
        <Container sx={{ position:'relative', zIndex:1 }}>
          <FadeSection>
            <Typography variant="overline" display="block" align="center" sx={{ color:'primary.main', fontWeight:700, letterSpacing:2, mb:1.5 }}>Precios</Typography>
            <Typography variant="h3" align="center" fontWeight={800} sx={{ fontSize:{ xs:'1.85rem', md:'2.6rem' }, mb:1.5 }}>
              Planes para cada <Box component="span" sx={{ color:'primary.main' }}>restaurante</Box>
            </Typography>
            <Typography variant="body1" align="center" color="textSecondary" sx={{ maxWidth:520, mx:'auto', mb:7, lineHeight:1.75 }}>
              Empieza gratis y escalá cuando lo necesités. Sin compromisos, cancelación en cualquier momento.
            </Typography>
          </FadeSection>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-60px' }} variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.12 } } }}>
            <Grid container spacing={3} alignItems="stretch">
              {Object.entries(plans).map(([planKey, planData]) => {
                const isUltra = planData.highlight
                return (
                  <Grid item xs={12} sm={6} md={4} key={planKey}>
                    <motion.div variants={scaleIn} whileHover={{ y:isUltra ? -14 : -8, transition:{ duration:0.28 } }} style={{ height:'100%' }}>
                      <Card elevation={0} sx={{
                        height:'100%', display:'flex', flexDirection:'column', borderRadius:4,
                        position:'relative', overflow:'hidden',
                        border: isUltra ? 'none' : `1.5px solid ${alpha(planData.color,0.25)}`,
                        ...(isUltra && {
                          background:`linear-gradient(145deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, #1de9b6 130%)`,
                          boxShadow:`0 32px 80px ${alpha(theme.palette.primary.main,0.4)}, 0 8px 24px rgba(0,0,0,0.12)`
                        }),
                        ...(!isUltra && { bgcolor:'#fff', transition:'box-shadow 0.3s', '&:hover':{ boxShadow:`0 20px 50px ${alpha(planData.color,0.18)}` } })
                      }}>
                        {isUltra && (
                          <Box sx={{ position:'absolute', top:0, left:0, right:0, height:3,
                            background:'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.4) 50%, #fff 100%)',
                            animation:'shimmer 2.5s linear infinite', backgroundSize:'200% 100%',
                            '@keyframes shimmer':{ '0%':{ backgroundPosition:'-200% 0' }, '100%':{ backgroundPosition:'200% 0' } }
                          }}/>
                        )}
                        <Box sx={{ p:{ xs:3, md:3.5 }, flexGrow:1, display:'flex', flexDirection:'column' }}>
                          <Box sx={{ mb:2.5 }}>
                            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:0.75 }}>
                              <Typography variant="h5" fontWeight={800} sx={{ color:isUltra ? '#fff' : planData.color }}>{planData.name}</Typography>
                              {planData.badge && (
                                <Chip label={planData.badge} size="small"
                                  icon={isUltra ? <StarIcon sx={{ fontSize:'14px !important', color:'inherit !important' }}/> : undefined}
                                  sx={{ fontWeight:700, fontSize:'0.7rem', height:26,
                                    ...(isUltra ? { bgcolor:'rgba(255,255,255,0.2)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)' }
                                      : { bgcolor:alpha(planData.color,0.1), color:planData.color })
                                  }}
                                />
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ color:isUltra ? 'rgba(255,255,255,0.75)' : 'text.secondary' }}>{planData.description}</Typography>
                          </Box>

                          <Box sx={{ mb:3 }}>
                            {dolarLoading ? (
                              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                                <CircularProgress size={22} sx={{ color:isUltra ? '#fff' : planData.color }}/>
                                <Typography variant="body2" sx={{ color:isUltra ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>Cargando precio…</Typography>
                              </Box>
                            ) : (
                              <>
                                <Typography variant="h3" fontWeight={800} sx={{ color:isUltra ? '#fff' : planData.color, lineHeight:1 }}>
                                  {formatPriceARS(planData.priceUsd * blueVenta)}
                                  <Typography component="span" variant="body2" fontWeight={500} sx={{ ml:0.75, color:isUltra ? 'rgba(255,255,255,0.65)' : 'text.secondary' }}>/mes</Typography>
                                </Typography>
                                <Typography variant="caption" sx={{ color:isUltra ? 'rgba(255,255,255,0.55)' : 'text.secondary', mt:0.5, display:'block' }}>
                                  ({formatPriceUSD(planData.priceUsd)})
                                </Typography>
                              </>
                            )}
                          </Box>

                          <Box sx={{ mb:2.5, height:1, bgcolor:isUltra ? 'rgba(255,255,255,0.2)' : 'divider' }}/>

                          <Typography variant="caption" fontWeight={700} sx={{ mb:1.25, display:'block', textTransform:'uppercase', letterSpacing:0.8, color:isUltra ? 'rgba(255,255,255,0.6)' : 'text.secondary' }}>Incluye</Typography>
                          <List dense disablePadding sx={{ mb:planData.limitations?.length ? 2 : 'auto', flex: planData.limitations?.length ? 'none' : 1 }}>
                            {planData.features.map((feature,idx) => (
                              <ListItem key={idx} disableGutters sx={{ py:0.3, alignItems:'flex-start' }}>
                                <ListItemIcon sx={{ minWidth:24, mt:0.2 }}>
                                  <CheckIcon sx={{ fontSize:15, color:isUltra ? '#69f0ae' : theme.palette.primary.main }}/>
                                </ListItemIcon>
                                <ListItemText primary={feature} primaryTypographyProps={{ variant:'body2', sx:{ fontSize:'0.8rem', lineHeight:1.55, color:isUltra ? 'rgba(255,255,255,0.85)' : 'text.primary' } }}/>
                              </ListItem>
                            ))}
                          </List>

                          {planData.limitations?.length > 0 && (
                            <>
                              <Typography variant="caption" fontWeight={700} sx={{ mb:1.25, display:'block', textTransform:'uppercase', letterSpacing:0.8, color:'text.secondary' }}>No incluye</Typography>
                              <List dense disablePadding sx={{ mb:3, flex:1 }}>
                                {planData.limitations.map((lim,idx) => (
                                  <ListItem key={idx} disableGutters sx={{ py:0.3, alignItems:'flex-start' }}>
                                    <ListItemIcon sx={{ minWidth:24, mt:0.2 }}>
                                      <CloseIcon sx={{ fontSize:14, color:'text.disabled' }}/>
                                    </ListItemIcon>
                                    <ListItemText primary={lim} primaryTypographyProps={{ variant:'body2', sx:{ fontSize:'0.8rem', color:'text.secondary' } }}/>
                                  </ListItem>
                                ))}
                              </List>
                            </>
                          )}

                          <Box sx={{ mt:'auto' }}>
                            <motion.div whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
                              <Button variant={isUltra ? 'contained' : 'outlined'} fullWidth size="large"
                                onClick={planData.ctaAction} endIcon={<ArrowForwardIcon/>}
                                sx={{ py:1.5, fontWeight:700, borderRadius:2.5, textTransform:'none', fontSize:'0.95rem',
                                  ...(isUltra ? {
                                    bgcolor:'rgba(255,255,255,0.18)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.4)', backdropFilter:'blur(8px)',
                                    '&:hover':{ bgcolor:'rgba(255,255,255,0.28)', border:'1.5px solid rgba(255,255,255,0.6)' }
                                  } : {
                                    borderColor:planData.color, color:planData.color, borderWidth:1.5,
                                    '&:hover':{ borderWidth:1.5, bgcolor:alpha(planData.color,0.05) }
                                  })
                                }}>
                                {planData.cta}
                              </Button>
                            </motion.div>
                          </Box>
                        </Box>
                      </Card>
                    </motion.div>
                  </Grid>
                )
              })}
            </Grid>
          </motion.div>
          <FadeSection delay={0.2}>
            <Typography variant="caption" display="block" sx={{ mt:4, textAlign:'center', color:'text.secondary' }}>
              Cotización del dólar blue utilizada: {formatPriceARS(blueVenta)}
            </Typography>
          </FadeSection>
        </Container>
      </Box>

      {/* ─── BENEFITS ──────────────────────────────────────────────────── */}
      <Box sx={{ py:{ xs:10, md:14 }, bgcolor:'#f7faf9' }}>
        <Container>
          <Grid container spacing={{ xs:6, md:10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <FadeSection direction="left">
                <Typography variant="overline" sx={{ color:'primary.main', fontWeight:700, letterSpacing:2, mb:1.5, display:'block' }}>Beneficios</Typography>
                <Typography variant="h3" fontWeight={800} sx={{ fontSize:{ xs:'1.85rem', md:'2.5rem' }, mb:1.5 }}>
                  Qué aporta <Box component="span" sx={{ color:'primary.main' }}>a tu operación</Box>
                </Typography>
                <Typography color="textSecondary" sx={{ mb:4, lineHeight:1.75 }}>
                  No prometemos porcentajes mágicos: MozoQR está pensado para ordenar procesos que hoy suelen repartirse entre papel, memoria y mensajes sueltos.
                </Typography>
                <motion.div initial="hidden" whileInView="visible" viewport={{ once:true }} variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.08 } } }}>
                  {benefits.map((text,i) => (
                    <motion.div key={i} variants={fadeUp}>
                      <Box sx={{ display:'flex', alignItems:'flex-start', gap:2, mb:1.75, p:2, borderRadius:2.5, transition:'background 0.2s', '&:hover':{ bgcolor:alpha(theme.palette.primary.main,0.05) } }}>
                        <Box sx={{ width:28, height:28, borderRadius:'50%', flexShrink:0, mt:0.1, display:'flex', alignItems:'center', justifyContent:'center', bgcolor:alpha(theme.palette.success.main,0.12) }}>
                          <CheckIcon sx={{ fontSize:15, color:'success.main' }}/>
                        </Box>
                        <Typography variant="body1" fontWeight={500} sx={{ lineHeight:1.65 }}>{text}</Typography>
                      </Box>
                    </motion.div>
                  ))}
                </motion.div>
              </FadeSection>
            </Grid>
            <Grid item xs={12} md={6}>
              <FadeSection direction="right" delay={0.1}>
                <Card elevation={0} sx={{ p:{ xs:4, md:5 }, borderRadius:4, background:`linear-gradient(135deg, #e0f2f1 0%, #fff8e1 100%)`, border:'1px solid', borderColor:alpha(theme.palette.primary.main,0.15), boxShadow:`0 24px 60px ${alpha(theme.palette.primary.main,0.1)}` }}>
                  <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb:1 }}>Comenzá hoy mismo</Typography>
                  <Typography color="textSecondary" sx={{ mb:4, lineHeight:1.7 }}>
                    Recorré la demo con rol de comensal, cocina y dueño. Sin tarjeta para explorar el flujo.
                  </Typography>
                  <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
                    <Button variant="contained" size="large" fullWidth endIcon={<ArrowForwardIcon/>} onClick={() => navigate('/demo')}
                      sx={{ mb:2, py:1.75, fontWeight:700, borderRadius:2.5, fontSize:'1rem', boxShadow:`0 10px 30px ${alpha(theme.palette.primary.main,0.3)}` }}>
                      Empezar demostración
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
                    <Button variant="outlined" size="large" fullWidth href="mailto:ventas@mozoqr.com"
                      sx={{ py:1.5, borderRadius:2.5, fontWeight:600, borderWidth:1.5, '&:hover':{ borderWidth:1.5 } }}>
                      Contactar ventas
                    </Button>
                  </motion.div>
                  <Box sx={{ mt:3.5, pt:3, borderTop:1, borderColor:'divider' }}>
                    {['Sin tarjeta de crédito','Cancelación en cualquier momento'].map(t => (
                      <Box key={t} sx={{ display:'flex', alignItems:'center', gap:1.25, mb:1 }}>
                        <CheckCircleIcon sx={{ color:'success.main', fontSize:18 }}/>
                        <Typography variant="body2" color="textSecondary">{t}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>
              </FadeSection>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── FLOW PILLARS ──────────────────────────────────────────────── */}
      <Box sx={{ py:{ xs:10, md:14 }, bgcolor:'#fff' }}>
        <Container>
          <FadeSection>
            <Typography variant="overline" display="block" align="center" sx={{ color:'primary.main', fontWeight:700, letterSpacing:2, mb:1.5 }}>Cómo funciona</Typography>
            <Typography variant="h3" align="center" fontWeight={800} sx={{ fontSize:{ xs:'1.85rem', md:'2.6rem' }, mb:1.5 }}>
              Tres lugares, <Box component="span" sx={{ color:'primary.main' }}>un mismo flujo</Box>
            </Typography>
            <Typography variant="body1" align="center" color="textSecondary" sx={{ maxWidth:520, mx:'auto', mb:8, lineHeight:1.75 }}>
              Así encaja MozoQR en el día a día: del comensal al fogón y del fogón al panel del dueño.
            </Typography>
          </FadeSection>
          <Box sx={{ position:'relative' }}>
            <Box sx={{ display:{ xs:'none', md:'block' }, position:'absolute', top:56, left:'16.66%', right:'16.66%', height:2, background:`linear-gradient(90deg, ${flowPillars[0].color}, ${flowPillars[1].color}, ${flowPillars[2].color})`, opacity:0.3, zIndex:0 }}/>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:'-60px' }} variants={{ hidden:{}, visible:{ transition:{ staggerChildren:0.15 } } }}>
              <Grid container spacing={3}>
                {flowPillars.map(pillar => (
                  <Grid item xs={12} md={4} key={pillar.title}>
                    <motion.div variants={fadeUp} whileHover={{ y:-10, transition:{ duration:0.28 } }} style={{ height:'100%' }}>
                      <Card elevation={0} sx={{
                        p:3.5, height:'100%', borderRadius:3.5, border:'1px solid', borderColor:alpha(pillar.color,0.2), bgcolor:'#fff', position:'relative', overflow:'hidden',
                        transition:'box-shadow 0.3s, border-color 0.3s',
                        '&:hover':{ boxShadow:`0 20px 50px ${alpha(pillar.color,0.18)}`, borderColor:alpha(pillar.color,0.5) },
                        '&::before':{ content:'""', position:'absolute', top:0, left:0, right:0, height:4, borderRadius:'3.5px 3.5px 0 0', bgcolor:pillar.color }
                      }}>
                        <Box sx={{ width:52, height:52, borderRadius:'50%', mb:2.5, display:'flex', alignItems:'center', justifyContent:'center', bgcolor:alpha(pillar.color,0.1), border:`2px solid ${alpha(pillar.color,0.25)}` }}>
                          <Typography fontWeight={800} sx={{ color:pillar.color, fontSize:'1.1rem' }}>{pillar.num}</Typography>
                        </Box>
                        <Typography variant="overline" sx={{ color:pillar.color, fontWeight:700, letterSpacing:1 }}>{pillar.subtitle}</Typography>
                        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mt:0.5, mb:1.5 }}>{pillar.title}</Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ lineHeight:1.75 }}>{pillar.body}</Typography>
                      </Card>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          </Box>
        </Container>
      </Box>

      {/* ─── FINAL CTA ─────────────────────────────────────────────────── */}
      <Box sx={{
        py:{ xs:10, md:14 }, position:'relative', overflow:'hidden',
        background:`linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, #26a69a 100%)`
      }}>
        <Box sx={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:`linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`, backgroundSize:'52px 52px' }}/>
        <Container sx={{ position:'relative', zIndex:1 }}>
          <FadeSection>
            <Box sx={{ maxWidth:700, mx:'auto', textAlign:'center' }}>
              <Typography variant="overline" sx={{ color:'rgba(255,255,255,0.65)', fontWeight:700, letterSpacing:2, mb:2, display:'block' }}>Demo gratuita</Typography>
              <Typography variant="h3" fontWeight={800} sx={{ color:'#fff', fontSize:{ xs:'2rem', md:'3rem' }, mb:2.5, lineHeight:1.2 }}>
                ¿Querés ver MozoQR en acción?
              </Typography>
              <Typography variant="h6" sx={{ color:'rgba(255,255,255,0.8)', mb:5, lineHeight:1.7, fontWeight:400 }}>
                Entrá a la demo: probá pedidos, cocina y panel de dueño con datos de ejemplo, y elegí el plan cuando encaje con tu negocio.
              </Typography>
              <Stack direction={{ xs:'column', sm:'row' }} spacing={2} justifyContent="center">
                <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}>
                  <Button variant="contained" size="large" endIcon={<ArrowForwardIcon/>} onClick={() => navigate('/demo')}
                    sx={{ bgcolor:'#fff', color:'primary.main', px:4, py:1.75, fontSize:'1rem', fontWeight:700, borderRadius:2.5, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', '&:hover':{ bgcolor:'grey.100', boxShadow:'0 12px 40px rgba(0,0,0,0.3)' } }}>
                    Comenzar gratis ahora
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}>
                  <Button variant="outlined" size="large" href="mailto:ventas@mozoqr.com"
                    sx={{ borderColor:'rgba(255,255,255,0.5)', color:'#fff', borderWidth:1.5, px:4, py:1.75, fontSize:'1rem', fontWeight:600, borderRadius:2.5, '&:hover':{ borderColor:'#fff', borderWidth:1.5, bgcolor:'rgba(255,255,255,0.1)' } }}>
                    Contactar Ventas
                  </Button>
                </motion.div>
              </Stack>
            </Box>
          </FadeSection>
        </Container>
      </Box>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
      <Box sx={{ backgroundColor:'#181818', color:'#f5f5f5', py:7 }}>
        <Container>
          <Box sx={{ maxWidth:480, mx:'auto', textAlign:'center' }}>
            <Typography variant="h5" fontWeight={800} gutterBottom sx={{ letterSpacing:'-0.02em' }}>MozoQR</Typography>
            <Typography variant="body2" sx={{ color:'#999', mb:3.5, lineHeight:1.75 }}>
              Pedidos, cocina, cuenta y administración en un solo ecosistema.
            </Typography>
            <Box sx={{ display:'flex', justifyContent:'center', gap:4, mb:4, flexWrap:'wrap' }}>
              {['Términos','Privacidad','Contacto'].map(link => (
                <Box key={link} component="a" href="#" sx={{ color:'#888', textDecoration:'none', fontSize:'0.875rem', fontWeight:500, transition:'color 0.2s', '&:hover':{ color:'#fff' } }}>
                  {link}
                </Box>
              ))}
            </Box>
            <Box sx={{ width:40, height:1, bgcolor:'#333', mx:'auto', mb:3 }}/>
            <Typography variant="caption" sx={{ color:'#555', display:'block' }}>
              © {new Date().getFullYear()} MozoQR. Todos los derechos reservados.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}