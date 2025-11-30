// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Snackbar,
  Tooltip,
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
  CorporateFare as BuildingIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  Subscriptions as SubscriptionsIcon,
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import { useRestaurantes } from '../hooks/useRestaurantes';
import { getAllOwnerComments, toggleArchiveComment } from '../api/comments';
import axios from 'axios';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

// Helper para obtener token
function getToken() {
  return localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt') || null;
}

// Función para obtener precios de planes desde localStorage o valores por defecto
function getPlanPrices() {
  const stored = localStorage.getItem('admin_plan_prices');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing plan prices:', e);
    }
  }
  // Valores por defecto
  return {
    basic: 0,
    pro: 29.99,
    ultra: 59.99,
  };
}

// Función para guardar precios de planes en localStorage
function savePlanPrices(prices) {
  localStorage.setItem('admin_plan_prices', JSON.stringify(prices));
}

// Función para calcular fecha de vencimiento basada en suscripción (todos los planes son 30 días)
function getExpirationDate(suscripcion) {
  const today = new Date();
  const expiration = new Date(today);
  // Todos los planes tienen duración de 30 días
  expiration.setDate(today.getDate() + 30);
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

export default function AdminDashboard() {
  const { restaurantes, loading, error, refetch } = useRestaurantes();
  const [activeTab, setActiveTab] = useState(0);
  
  // Estados para comentarios
  const [ownerComments, setOwnerComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState(null);
  const [commentsFilter, setCommentsFilter] = useState('active'); // 'active', 'archived', 'all'
  
  // Cargar comentarios cuando se monta el componente o cuando se cambia al tab de comentarios
  useEffect(() => {
    if (activeTab === 3) {
      const loadComments = async () => {
        setCommentsLoading(true);
        setCommentsError(null);
        try {
          const archived = commentsFilter === 'archived' ? true : commentsFilter === 'active' ? false : undefined;
          const comments = await getAllOwnerComments({ archived });
          setOwnerComments(comments);
        } catch (err) {
          console.error('Error loading comments:', err);
          setCommentsError('Error al cargar los comentarios');
        } finally {
          setCommentsLoading(false);
        }
      };
      loadComments();
    }
  }, [activeTab, commentsFilter]);
  const [filterSubscription, setFilterSubscription] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openRestaurantDialog, setOpenRestaurantDialog] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [planPrices, setPlanPrices] = useState(() => getPlanPrices());

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
    const activeSubscriptions = restaurantes.filter((r) => {
      const expiration = getExpirationDate(r.suscripcion);
      return expiration > new Date();
    }).length;
    const expiredSubscriptions = total - activeSubscriptions;
    
    // Calcular ingresos mensuales usando precios dinámicos
    const monthlyRevenue = (basic * planPrices.basic) + (pro * planPrices.pro) + (ultra * planPrices.ultra);

    return { total, basic, pro, ultra, activeSubscriptions, expiredSubscriptions, monthlyRevenue };
  }, [restaurantes, planPrices]);

  // Preparar datos de suscripciones para tabla
  const subscriptionsData = useMemo(() => {
    return restaurantes.map((r) => {
      const expiration = getExpirationDate(r.suscripcion);
      const daysUntilExpiration = Math.ceil(
        (expiration - new Date()) / (1000 * 60 * 60 * 24)
      );
      const isExpired = daysUntilExpiration <= 0;
      const isExpiringSoon = daysUntilExpiration <= 7 && daysUntilExpiration > 0;

      return {
        id: r.id,
        restaurantName: r.name,
        restaurantSlug: r.slug,
        plan: r.suscripcion,
        startDate: r.createdAt,
        expirationDate: expiration,
        daysUntilExpiration,
        status: isExpired ? 'expired' : isExpiringSoon ? 'expiring_soon' : 'active',
        mesas: r.mesas || 0,
        members: Array.isArray(r.restaurant_members)
          ? r.restaurant_members.length
          : (r.restaurant_members || 0),
      };
    });
  }, [restaurantes]);

  const handleOpenRestaurantDialog = (restaurant = null) => {
    setEditingRestaurant(restaurant);
    setOpenRestaurantDialog(true);
  };

  const handleCloseRestaurantDialog = () => {
    setOpenRestaurantDialog(false);
    setEditingRestaurant(null);
  };

  const handleDeleteRestaurant = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este restaurante?')) {
      return;
    }

    try {
      const token = getToken();
      await axios.delete(`${API_URL}/restaurantes/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSnackbar({
        open: true,
        message: 'Restaurante eliminado correctamente',
        severity: 'success',
      });
      refetch();
    } catch (err) {
      console.error('Error deleting restaurant:', err);
      setSnackbar({
        open: true,
        message: 'Error al eliminar el restaurante',
        severity: 'error',
      });
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

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
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={refetch}
          sx={{ ml: 2 }}
        >
          Actualizar
        </Button>
      </Box>

      {/* Estadísticas generales */}
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
            title="Suscripciones Activas"
            value={stats.activeSubscriptions}
            icon={<CheckCircleIcon />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Suscripciones Expiradas"
            value={stats.expiredSubscriptions}
            icon={<WarningIcon />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ingresos Mensuales"
            value={`$${stats.monthlyRevenue.toFixed(2)}`}
            icon={<TrendingUpIcon />}
            color="#9C27B0"
          />
        </Grid>
      </Grid>

      {/* Tabs de navegación */}
      <Card sx={{ mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<DashboardIcon />} iconPosition="start" label="Resumen" />
          <Tab icon={<RestaurantIcon />} iconPosition="start" label="Restaurantes" />
          <Tab icon={<SubscriptionsIcon />} iconPosition="start" label="Suscripciones" />
          <Tab icon={<MessageIcon />} iconPosition="start" label="Comentarios" />
          <Tab icon={<SettingsIcon />} iconPosition="start" label="Configuración" />
        </Tabs>
      </Card>

      {/* Contenido de tabs */}
      {activeTab === 0 && (
        <OverviewTab
          stats={stats}
          restaurantes={restaurantes}
          subscriptionsData={subscriptionsData}
          planPrices={planPrices}
        />
      )}

      {activeTab === 1 && (
        <RestaurantsTab
          restaurantes={filteredRestaurantes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterSubscription={filterSubscription}
          setFilterSubscription={setFilterSubscription}
          onEdit={handleOpenRestaurantDialog}
          onDelete={handleDeleteRestaurant}
          onAdd={() => handleOpenRestaurantDialog(null)}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}

      {activeTab === 2 && (
        <SubscriptionsTab
          subscriptions={subscriptionsData}
          restaurantes={restaurantes}
          onUpdateSubscription={async (restaurantId, newPlan) => {
            try {
              const token = getToken();
              await axios.put(
                `${API_URL}/restaurantes/${restaurantId}`,
                {
                  data: { Suscripcion: newPlan },
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              setSnackbar({
                open: true,
                message: 'Suscripción actualizada correctamente',
                severity: 'success',
              });
              refetch();
            } catch (err) {
              console.error('Error updating subscription:', err);
              setSnackbar({
                open: true,
                message: 'Error al actualizar la suscripción',
                severity: 'error',
              });
            }
          }}
        />
      )}

      {activeTab === 3 && (
        <CommentsTab
          comments={ownerComments}
          loading={commentsLoading}
          error={commentsError}
          filter={commentsFilter}
          onFilterChange={setCommentsFilter}
          onRefresh={async () => {
            setCommentsLoading(true);
            setCommentsError(null);
            try {
              const archived = commentsFilter === 'archived' ? true : commentsFilter === 'active' ? false : undefined;
              const comments = await getAllOwnerComments({ archived });
              setOwnerComments(comments);
            } catch (err) {
              console.error('Error loading comments:', err);
              setCommentsError('Error al cargar los comentarios');
            } finally {
              setCommentsLoading(false);
            }
          }}
          onArchive={async (commentId) => {
            try {
              console.log('Intentando archivar comentario con ID:', commentId);
              const result = await toggleArchiveComment(commentId);
              console.log('Resultado del archivo:', result);
              // Recargar comentarios
              const archived = commentsFilter === 'archived' ? true : commentsFilter === 'active' ? false : undefined;
              const comments = await getAllOwnerComments({ archived });
              setOwnerComments(comments);
              setSnackbar({
                open: true,
                message: 'Comentario archivado/desarchivado correctamente',
                severity: 'success',
              });
            } catch (err) {
              console.error('Error archiving comment:', err);
              console.error('Error details:', err.response?.data);
              setSnackbar({
                open: true,
                message: err.response?.data?.error?.message || err.message || 'Error al archivar el comentario',
                severity: 'error',
              });
            }
          }}
        />
      )}

      {activeTab === 4 && (
        <SettingsTab
          planPrices={planPrices}
          onPlanPricesChange={(newPrices) => {
            setPlanPrices(newPrices);
            savePlanPrices(newPrices);
            setSnackbar({
              open: true,
              message: 'Precios de planes actualizados correctamente',
              severity: 'success',
            });
          }}
        />
      )}

      {/* Dialog para crear/editar restaurante */}
      <RestaurantDialog
        open={openRestaurantDialog}
        onClose={handleCloseRestaurantDialog}
        restaurant={editingRestaurant}
        onSave={async (data) => {
          try {
            const token = getToken();
            if (editingRestaurant) {
              // Actualizar
              await axios.put(
                `${API_URL}/restaurantes/${editingRestaurant.id}`,
                { data },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              setSnackbar({
                open: true,
                message: 'Restaurante actualizado correctamente',
                severity: 'success',
              });
            } else {
              // Crear
              await axios.post(
                `${API_URL}/restaurantes`,
                { data },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              setSnackbar({
                open: true,
                message: 'Restaurante creado correctamente',
                severity: 'success',
              });
            }
            handleCloseRestaurantDialog();
            refetch();
          } catch (err) {
            console.error('Error saving restaurant:', err);
            setSnackbar({
              open: true,
              message: 'Error al guardar el restaurante',
              severity: 'error',
            });
          }
        }}
      />

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
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

// Tab de Resumen
function OverviewTab({ stats, restaurantes, subscriptionsData, planPrices }) {
  const expiringSoon = subscriptionsData.filter((s) => s.status === 'expiring_soon');
  const expired = subscriptionsData.filter((s) => s.status === 'expired');

  return (
    <Grid container spacing={3}>
      {/* Distribución de planes */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Distribución de Planes
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="BASIC" size="small" sx={{ bgcolor: '#f5f5f5', color: '#616161' }} />
                  <Typography variant="body2" color="text.secondary">
                    {stats.basic} restaurantes
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {stats.total > 0 ? ((stats.basic / stats.total) * 100).toFixed(1) : 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${planPrices.basic.toFixed(2)}/mes
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="PRO" size="small" sx={{ bgcolor: '#e0f2f1', color: '#00695c' }} />
                  <Typography variant="body2" color="text.secondary">
                    {stats.pro} restaurantes
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {stats.total > 0 ? ((stats.pro / stats.total) * 100).toFixed(1) : 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${planPrices.pro.toFixed(2)}/mes
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="ULTRA" size="small" sx={{ bgcolor: '#f3e5f5', color: '#7b1fa2' }} />
                  <Typography variant="body2" color="text.secondary">
                    {stats.ultra} restaurantes
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {stats.total > 0 ? ((stats.ultra / stats.total) * 100).toFixed(1) : 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${planPrices.ultra.toFixed(2)}/mes
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Alertas */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Alertas del Sistema
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {expired.length > 0 && (
                <Alert severity="error" icon={<WarningIcon />}>
                  {expired.length} suscripción(es) expirada(s) requieren atención
                </Alert>
              )}
              {expiringSoon.length > 0 && (
                <Alert severity="warning" icon={<AccessTimeIcon />}>
                  {expiringSoon.length} suscripción(es) por vencer en los próximos 7 días
                </Alert>
              )}
              {expired.length === 0 && expiringSoon.length === 0 && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  Todas las suscripciones están al día
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Restaurantes recientes */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Restaurantes Recientes
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Fecha de Creación</TableCell>
                    <TableCell>Mesas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {restaurantes
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5)
                    .map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.slug}</TableCell>
                        <TableCell>
                          <Chip
                            {...getSubscriptionChipProps(r.suscripcion)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDate(r.createdAt)}</TableCell>
                        <TableCell>{r.mesas || 0}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// Tab de Restaurantes
function RestaurantsTab({
  restaurantes,
  searchQuery,
  setSearchQuery,
  filterSubscription,
  setFilterSubscription,
  onEdit,
  onDelete,
  onAdd,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) {
  return (
    <Box>
      {/* Filtros y búsqueda */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Buscar restaurante por nombre o slug..."
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

      {/* Botón agregar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
        >
          Crear Nuevo Restaurante
        </Button>
      </Box>

      {/* Tabla de restaurantes */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Mesas</TableCell>
                <TableCell>Miembros</TableCell>
                <TableCell>Fecha Creación</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {restaurantes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No se encontraron restaurantes
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                restaurantes
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((restaurante) => (
                    <TableRow key={restaurante.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {restaurante.name || `Restaurante ${restaurante.id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>{restaurante.slug}</TableCell>
                      <TableCell>
                        <Chip
                          {...getSubscriptionChipProps(restaurante.suscripcion)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{restaurante.mesas || 0}</TableCell>
                      <TableCell>
                        {Array.isArray(restaurante.restaurant_members)
                          ? restaurante.restaurant_members.length
                          : (restaurante.restaurant_members || 0)}
                      </TableCell>
                      <TableCell>{formatDate(restaurante.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => onEdit(restaurante)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              onClick={() => onDelete(restaurante.id)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={restaurantes.length}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas por página:"
        />
      </Card>
    </Box>
  );
}

// Tab de Suscripciones
function SubscriptionsTab({ subscriptions, restaurantes, onUpdateSubscription }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.restaurantName?.toLowerCase().includes(query) ||
          s.restaurantSlug?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [subscriptions, filterStatus, searchQuery]);

  return (
    <Box>
      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar por nombre o slug..."
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Filtrar por estado"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Todos los estados</MenuItem>
                <MenuItem value="active">Activas</MenuItem>
                <MenuItem value="expiring_soon">Por vencer</MenuItem>
                <MenuItem value="expired">Expiradas</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de suscripciones */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Restaurante</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Fecha Inicio</TableCell>
                <TableCell>Fecha Vencimiento</TableCell>
                <TableCell>Días Restantes</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No se encontraron suscripciones
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {sub.restaurantName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {sub.restaurantSlug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        {...getSubscriptionChipProps(sub.plan)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(sub.startDate)}</TableCell>
                    <TableCell>{formatDate(sub.expirationDate)}</TableCell>
                    <TableCell>
                      <Chip
                        label={
                          sub.daysUntilExpiration > 0
                            ? `${sub.daysUntilExpiration} días`
                            : 'Vencido'
                        }
                        color={
                          sub.daysUntilExpiration > 7
                            ? 'success'
                            : sub.daysUntilExpiration > 0
                            ? 'warning'
                            : 'error'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          sub.status === 'active'
                            ? 'Activa'
                            : sub.status === 'expiring_soon'
                            ? 'Por vencer'
                            : 'Expirada'
                        }
                        color={
                          sub.status === 'active'
                            ? 'success'
                            : sub.status === 'expiring_soon'
                            ? 'warning'
                            : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        select
                        size="small"
                        value={sub.plan}
                        onChange={(e) => onUpdateSubscription(sub.id, e.target.value)}
                        SelectProps={{
                          native: true,
                        }}
                        sx={{ minWidth: 100 }}
                      >
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="ultra">Ultra</option>
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

// Tab de Configuración
function SettingsTab({ planPrices, onPlanPricesChange }) {
  const [localPrices, setLocalPrices] = useState(planPrices);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalPrices(planPrices);
    setHasChanges(false);
  }, [planPrices]);

  const handlePriceChange = (plan) => (e) => {
    const value = parseFloat(e.target.value) || 0;
    const newPrices = { ...localPrices, [plan]: value };
    setLocalPrices(newPrices);
    setHasChanges(true);
  };

  const handleSave = () => {
    onPlanPricesChange(localPrices);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalPrices(planPrices);
    setHasChanges(false);
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Configuración de Planes
              </Typography>
              {hasChanges && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={handleReset}
                    startIcon={<CancelIcon />}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleSave}
                    startIcon={<SaveIcon />}
                  >
                    Guardar
                  </Button>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Plan Basic
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Duración: 30 días
                </Typography>
                <TextField
                  label="Precio Mensual"
                  type="number"
                  value={localPrices.basic}
                  onChange={handlePriceChange('basic')}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  fullWidth
                  size="small"
                  helperText="Precio en dólares (USD) o pesos (ARS)"
                />
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Plan Pro
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Duración: 30 días
                </Typography>
                <TextField
                  label="Precio Mensual"
                  type="number"
                  value={localPrices.pro}
                  onChange={handlePriceChange('pro')}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  fullWidth
                  size="small"
                  helperText="Precio en dólares (USD) o pesos (ARS)"
                />
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Plan Ultra
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Duración: 30 días
                </Typography>
                <TextField
                  label="Precio Mensual"
                  type="number"
                  value={localPrices.ultra}
                  onChange={handlePriceChange('ultra')}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  fullWidth
                  size="small"
                  helperText="Precio en dólares (USD) o pesos (ARS)"
                />
              </Paper>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Información del Sistema
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Versión de la Plataforma
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  1.0.0
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Última Actualización
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {new Date().toLocaleDateString('es-AR')}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Estado del Servicio
                </Typography>
                <Chip label="Operativo" color="success" size="small" sx={{ mt: 0.5 }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// Dialog para crear/editar restaurante
function RestaurantDialog({ open, onClose, restaurant, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    Suscripcion: 'basic',
    cbu: '',
    cuenta_bancaria: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || '',
        slug: restaurant.slug || '',
        Suscripcion: restaurant.suscripcion || 'basic',
        cbu: restaurant.cbu || '',
        cuenta_bancaria: restaurant.cuenta_bancaria || '',
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        Suscripcion: 'basic',
        cbu: '',
        cuenta_bancaria: '',
      });
    }
    setErrors({});
  }, [restaurant, open]);

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (!formData.slug.trim()) {
      newErrors.slug = 'El slug es requerido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {restaurant ? 'Editar Restaurante' : 'Crear Nuevo Restaurante'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Nombre del Restaurante"
            value={formData.name}
            onChange={handleChange('name')}
            fullWidth
            required
            error={!!errors.name}
            helperText={errors.name}
          />
          <TextField
            label="Slug"
            value={formData.slug}
            onChange={handleChange('slug')}
            fullWidth
            required
            error={!!errors.slug}
            helperText={errors.slug || 'URL única del restaurante (ej: mi-restaurante)'}
          />
          <TextField
            label="Plan de Suscripción"
            select
            value={formData.Suscripcion}
            onChange={handleChange('Suscripcion')}
            fullWidth
            required
          >
            <MenuItem value="basic">Basic</MenuItem>
            <MenuItem value="pro">Pro</MenuItem>
            <MenuItem value="ultra">Ultra</MenuItem>
          </TextField>
          <TextField
            label="CBU"
            value={formData.cbu}
            onChange={handleChange('cbu')}
            fullWidth
            helperText="CBU para transferencias bancarias"
          />
          <TextField
            label="Cuenta Bancaria"
            value={formData.cuenta_bancaria}
            onChange={handleChange('cuenta_bancaria')}
            fullWidth
            helperText="Información adicional de cuenta bancaria"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CancelIcon />}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
        >
          {restaurant ? 'Actualizar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Tab de Comentarios
function CommentsTab({ comments, loading, error, onRefresh, filter, onFilterChange, onArchive }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={onRefresh}>
                Reintentar
              </Button>
            }
          >
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header con filtros y botón de actualizar */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Comentarios de Dueños
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Filtros */}
          <Button
            variant={filter === 'active' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onFilterChange('active')}
          >
            Activos
          </Button>
          <Button
            variant={filter === 'archived' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onFilterChange('archived')}
          >
            Archivados
          </Button>
          <Button
            variant={filter === 'all' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onFilterChange('all')}
          >
            Todos
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            sx={{ ml: 1 }}
          >
            Actualizar
          </Button>
        </Box>
      </Box>

      {/* Tabla de comentarios */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Restaurante</TableCell>
                <TableCell>Comentario</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {filter === 'archived' 
                        ? 'No hay comentarios archivados' 
                        : filter === 'active'
                        ? 'No hay comentarios activos'
                        : 'No hay comentarios aún'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                comments
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((comment) => {
                    const attr = comment.attributes || comment;
                    const isArchived = attr.archived || comment.archived || false;
                    // Obtener el ID correcto (puede ser comment.id o comment.documentId)
                    const commentId = comment.id || comment.documentId || attr.id;
                    return (
                      <TableRow 
                        key={comment.id || comment.documentId} 
                        hover
                        sx={{
                          opacity: isArchived ? 0.6 : 1,
                          bgcolor: isArchived ? 'action.hover' : 'transparent',
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {attr.restaurantName || 'N/A'}
                            {isArchived && (
                              <Chip 
                                label="Archivado" 
                                size="small" 
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                color="default"
                              />
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxWidth: 500 }}>
                            {attr.comment || 'Sin comentario'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(attr.createdAt || comment.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={isArchived ? 'Desarchivar' : 'Archivar'}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                console.log('Archivando comentario:', commentId, comment);
                                onArchive(commentId);
                              }}
                              color={isArchived ? 'default' : 'primary'}
                            >
                              {isArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={comments.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas por página:"
        />
      </Card>
    </Box>
  );
}
