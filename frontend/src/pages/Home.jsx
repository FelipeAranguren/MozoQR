//src/pages/Home.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Typography, Button, Grid, Card, CardContent, Box } from '@mui/material'
import QrCodeIcon from '@mui/icons-material/QrCode'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import BarChartIcon from '@mui/icons-material/BarChart'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import heroImage from '../assets/hero-image.jpg'

export default function Home() {
  const navigate = useNavigate()

  const features = [
    { icon: <QrCodeIcon color="primary" />, title: 'Sin contacto', desc: 'Los clientes escanean un QR en la mesa y ordenan desde su celular' },
    { icon: <SmartphoneIcon color="primary" />, title: 'Experiencia moderna', desc: 'Interfaz intuitiva diseñada para todas las edades' },
    { icon: <CreditCardIcon color="primary" />, title: 'Pagos digitales', desc: 'Múltiples métodos de pago integrados y seguros' },
    { icon: <BarChartIcon color="primary" />, title: 'Análisis en tiempo real', desc: 'Dashboard con métricas de ventas y productos populares' }
  ]

  const benefits = [
    'Reduce el tiempo de espera de tus clientes',
    'Elimina errores en los pedidos',
    'Aumenta el ticket promedio por mesa',
    'Libera personal para tareas más importantes',
    'Obtén datos valiosos sobre preferencias'
  ]

  return (
    <div>
      {/* Hero Section */}
      <Container sx={{ py: { xs: 6, md: 12 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 6 }}>
        <Box flex={1}>
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            Moderniza tu <span style={{ color: '#00796B' }}>restaurante</span>
          </Typography>
          <Typography variant="h6" color="textSecondary" paragraph>
            La plataforma que transforma la experiencia gastronómica. Sin filas, sin esperas, solo satisfacción.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" size="large" onClick={() => navigate('/restaurantes')}>
              Probar demo
            </Button>
            <Button variant="outlined" size="large">
              Solicitar información
            </Button>
          </Box>
        </Box>
        <Box flex={1}>
          <img src={heroImage} alt="Mesa de restaurante con QR" style={{ width: '100%', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} />
        </Box>
      </Container>

      {/* Features Section */}
      <Container sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#f9f9f9' }}>
        <Typography variant="h4" align="center" gutterBottom>
          ¿Por qué elegir Restaurante Digital?
        </Typography>
        <Typography variant="subtitle1" align="center" color="textSecondary" paragraph>
          Aumenta tus ventas, reduce costos operativos y mejora la experiencia de tus clientes
        </Typography>
        <Grid container spacing={4} sx={{ mt: 4 }}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card
                elevation={2}
                sx={{
                textAlign: 'center',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 220
               }}
            >
                <Box sx={{ mb: 2 }}>{f.icon}</Box>
                <Typography variant="h6" gutterBottom>{f.title}</Typography>
                <Typography variant="body2" color="textSecondary">{f.desc}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Benefits Section */}
      <Container sx={{ py: { xs: 8, md: 12 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" gutterBottom>
              Beneficios inmediatos para tu negocio
            </Typography>
            <Box sx={{ mt: 2 }}>
              {benefits.map((b, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
                  <CheckCircleIcon color="success" sx={{ mt: 0.5 }} />
                  <Typography variant="body1">{b}</Typography>
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card elevation={1} sx={{ p: 4, textAlign: 'center', background: 'linear-gradient(to bottom right, #e0f2f1, #fff8e1)' }}>
              <Typography variant="h5" gutterBottom>
                Comienza hoy mismo
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Configuración en menos de 24 horas. Sin instalación, sin hardware adicional.
              </Typography>
              <Button variant="contained" size="large" fullWidth>
                Empezar demostración
              </Button>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#212121', color: '#f5f5f5', py: 6 }}>
        <Container>
          <Typography variant="h5" align="center" gutterBottom>
            Restaurante Digital
          </Typography>
          <Typography variant="body2" align="center" color="#ccc" paragraph>
            Transformando la experiencia gastronómica, una mesa a la vez.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 2 }}>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Términos</a>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Privacidad</a>
            <a href="#" style={{ color: '#ccc', textDecoration: 'none' }}>Contacto</a>
          </Box>
        </Container>
      </Box>
    </div>
  )
}