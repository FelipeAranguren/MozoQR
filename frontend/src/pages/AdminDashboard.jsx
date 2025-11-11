// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  Alert,
  Button,
  Paper,
  Divider,
} from '@mui/material';
import {
  Restaurant as RestaurantIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  CreditCard as CreditCardIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  Message as MessageIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  CorporateFare as BuildingIcon, // <- reemplazo válido del ícono
} from '@mui/icons-material';
import { useRestaurantes } from '../hooks/useRestaurantes';

// Función para calcular fecha de vencimiento basada en suscripción
function getExpirationDate(suscripcion) {
  const today = new Date();
  const expiration = new Date(today);
  
  switch (suscripcion?.toLowerCase()) {
    case 'basic':
      expiration.setDate(today.getDate() + 15);
      break;
    case 'pro':
      expiration.setDate(today.getDate() + 30);
      break;
    case 'ultra':
      expiration.setDate(today.getDate() + 60);
      break;
    default:
      expiration.setDate(today.getDate() + 15);
  }
  
  return expiration;
}

// Función para formatear fecha
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Función para obtener el color del chip de suscripción
function getSubscriptionChipProps(suscripcion) {
  switch (suscripcion?.toLowerCase()) {
    case 'basic':
      return {
        label: 'BASIC',
        sx: {
          bgcolor: '#f5f5f5',
          color: '#616161',
          border: '1px solid #e0e0e0',
          fontWeight: 600,
        }
      };
    case 'pro':
      return {
        label: 'PRO',
        sx: {
          bgcolor: '#e0f2f1',
          color: '#00695c',
          border: '1px solid #80cbc4',
          fontWeight: 600,
        }
      };
    case 'ultra':
      return {
        label: 'ULTRA',
        sx: {
          bgcolor: '#f3e5f5',
          color: '#7b1fa2',
          border: '1px solid #ce93d8',
          fontWeight: 600,
        }
      };
    default:
      return {
        label: 'BASIC',
        sx: {
          bgcolor: '#f5f5f5',
          color: '#616161',
          border: '1px solid #e0e0e0',
          fontWeight: 600,
        }
      };
  }
}

// Función para obtener el color de la barra inferior
function getSubscriptionBarColor(suscripcion) {
  switch (suscripcion?.toLowerCase()) {
    case 'basic':
      return '#9e9e9e';
    case 'pro':
      return '#00796B';
    case 'ultra':
      return '#9C27B0';
    default:
      return '#9e9e9e';
  }
}

// Comentarios y feedback mock
const mockComments = [
  { id: 1, text: 'Excelente atención al cliente', type: 'positive', rating: 5 },
  { id: 2, text: 'Podría mejorar el tiempo de carga', type: 'negative', rating: 3 },
  { id: 3, text: 'Muy fácil de usar, los clientes lo aman', type: 'positive', rating: 5 },
  { id: 4, text: 'Falta agregar más métodos de pago', type: 'suggestion', rating: 4 },
  { id: 5, text: 'Sistema muy estable, sin problemas', type: 'positive', rating: 5 },
  { id: 6, text: 'Necesita mejor integración con contabilidad', type: 'suggestion', rating: 4 },
  { id: 7, text: 'Excelente soporte técnico', type: 'positive', rating: 5 },
  { id: 8, text: 'La app móvil podría ser más rápida', type: 'negative', rating: 3 },
];

export default function AdminDashboard() {
  const { restaurantes, loading, error, refetch } = useRestaurantes();
  const [filterSubscription, setFilterSubscription] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar restaurantes
  const filteredRestaurantes = useMemo(() => {
    let filtered = restaurantes;

    // Filtro por suscripción
    if (filterSubscription !== 'all') {
      filtered = filtered.filter(
        (r) => r.suscripcion?.toLowerCase() === filterSubscription.toLowerCase()
      );
    }

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(query) ||
          r.slug?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [restaurantes, filterSubscription, searchQuery]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const total = restaurantes.length;
    const basic = restaurantes.filter((r) => r.suscripcion?.toLowerCase() === 'basic').length;
    const pro = restaurantes.filter((r) => r.suscripcion?.toLowerCase() === 'pro').length;
    const ultra = restaurantes.filter((r) => r.suscripcion?.toLowerCase() === 'ultra').length;

    return { total, basic, pro, ultra };
  }, [restaurantes]);

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
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: '#e0f2f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BuildingIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Dashboard de Administración
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestiona y monitorea todos los restaurantes registrados
          </Typography>
        </Box>
      </Box>

      {/* Estadísticas de suscripciones */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Restaurantes"
            value={stats.total}
            icon={<RestaurantIcon />}
            color="#00796B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Basic"
            value={stats.basic}
            icon={<CreditCardIcon />}
            color="#757575"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pro"
            value={stats.pro}
            icon={<TrendingUpIcon />}
            color="#00796B"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ultra"
            value={stats.ultra}
            icon={<StarIcon />}
            color="#9C27B0"
          />
        </Grid>
      </Grid>

      {/* Filtros y búsqueda */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Buscar restaurante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Filtrar por suscripción"
                value={filterSubscription}
                onChange={(e) => setFilterSubscription(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="all">Todas las suscripciones</MenuItem>
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="ultra">Ultra</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Lista de restaurantes */}
      {filteredRestaurantes.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {filteredRestaurantes.map((restaurante, index) => (
            <Grid item xs={12} sm={6} lg={4} key={restaurante.id}>
              <RestaurantCard restaurante={restaurante} index={index} />
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && filteredRestaurantes.length === 0 && restaurantes.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <BuildingIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No se encontraron restaurantes con los filtros aplicados
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && restaurantes.length === 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <BuildingIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No hay restaurantes registrados
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Sección de comentarios y feedback */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: '#e0f2f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageIcon sx={{ color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Comentarios y Feedback
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {mockComments.map((comment, index) => (
              <Grid item xs={12} sm={6} md={3} key={comment.id}>
                <CommentCard comment={comment} index={index} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );
}

// Componente de tarjeta de estadística
function StatCard({ title, value, icon, color }) {
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-4px)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// Componente de tarjeta de restaurante
function RestaurantCard({ restaurante }) {
  const expirationDate = getExpirationDate(restaurante.suscripcion);
  const daysUntilExpiration = Math.ceil(
    (expirationDate - new Date()) / (1000 * 60 * 60 * 24)
  );

  const getExpirationColor = () => {
    if (daysUntilExpiration > 7) return 'success';
    if (daysUntilExpiration > 3) return 'warning';
    return 'error';
  };

  const chipProps = getSubscriptionChipProps(restaurante.suscripcion);
  const barColor = getSubscriptionBarColor(restaurante.suscripcion);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-4px)',
        },
      }}
    >
        {/* Barra de color según suscripción */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor: barColor,
          }}
        />
        
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 3 }}>
          {/* Header de la tarjeta */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                {restaurante.name || `Restaurante ${restaurante.id}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {restaurante.id}
              </Typography>
            </Box>
            <Chip 
              label={chipProps.label} 
              size="small"
              sx={chipProps.sx}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Información de suscripción */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                Vencimiento:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
                {formatDate(expirationDate)}
              </Typography>
              <Chip
                label={daysUntilExpiration > 0 ? `${daysUntilExpiration} días` : 'Vencido'}
                color={getExpirationColor()}
                size="small"
                variant="outlined"
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Mesas:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, ml: 'auto' }}>
                {restaurante.mesas || 0}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCardIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Miembros:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, ml: 'auto' }}>
                {Array.isArray(restaurante.restaurant_members)
                  ? restaurante.restaurant_members.length
                  : (restaurante.restaurant_members || 0)}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Información adicional */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Slug: {restaurante.slug}
            </Typography>
            {restaurante.cbu && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="caption" color="success.main">
                  CBU configurado
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
  );
}

// Componente de tarjeta de comentario
function CommentCard({ comment }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[...Array(5)].map((_, i) => (
            <StarIcon
              key={i}
              sx={{
                fontSize: 16,
                color: i < comment.rating ? 'warning.main' : 'grey.300',
              }}
            />
          ))}
        </Box>
        {comment.type === 'positive' && <CheckCircleIcon fontSize="small" color="success" />}
        {comment.type === 'negative' && <WarningIcon fontSize="small" color="error" />}
        {comment.type === 'suggestion' && <AccessTimeIcon fontSize="small" color="primary" />}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {comment.text}
      </Typography>
    </Paper>
  );
}
