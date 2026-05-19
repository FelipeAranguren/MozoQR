
// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  InputAdornment,
  TablePagination,
  Menu,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
  Stack
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Restaurant as RestaurantIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Login as LoginIcon,
  Message as MessageIcon,
  ReceiptLong as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  CardGiftcard as ClientesIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  CloudDownload as DownloadIcon,
  FilterList as FilterIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useRestaurantes } from '../hooks/useRestaurantes';
import { getAllOwnerComments } from '../api/comments';
import {
  fetchAdminUsers, createAdminUser, updateAdminUser, toggleBlockUser,
  resetUserPassword, fetchAdminMemberships, updateMembership, createMembership,
  fetchPermissionsOverview,
} from '../api/admin';
import UserDetailDialog from '../components/admin/UserDetailDialog';
import CustomersPanel from '../components/admin/CustomersPanel';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from '../theme';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

// --- Helpers ---
const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
};

function HealthBadge({ status }) {
  let color = 'default';
  let label = 'Desconocido';
  let icon = null;

  switch (status) {
    case 'healthy':
      color = 'success';
      label = 'Excelente';
      icon = <CheckCircleIcon fontSize="small" />;
      break;
    case 'warning':
      color = 'warning';
      label = 'Riesgo';
      icon = <WarningIcon fontSize="small" />;
      break;
    case 'critical':
      color = 'error';
      label = 'Inactivo';
      icon = <CancelIcon fontSize="small" />;
      break;
    default:
      break;
  }

  return (
    <Chip
      icon={icon}
      label={label}
      color={color}
      size="small"
      variant="filled"
      sx={{ fontWeight: 700, minWidth: 100 }}
    />
  );
}

function StatCard({ title, value, subtitle, icon, color }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow2 }}>
        <Box sx={{ position: 'absolute', top: -10, right: -10, opacity: 0.08, transform: 'scale(2.5)', color }}>
          {icon}
        </Box>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}14`, color: color, mr: 2, display: 'flex' }}>
              {icon}
            </Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5, color: COLORS.text }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RevenueChart({ data }) {
  if (!data || data.length === 0) return <Typography variant="caption">Sin datos suficientes</Typography>;

  const height = 100;
  const width = 300;
  const maxVal = Math.max(...data.map(d => d.amount)) || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (d.amount / maxVal) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Box sx={{ width: '100%', height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: COLORS.success, stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: COLORS.success, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`M0,${height} ${points} L${width},${height} Z`} fill="url(#grad)" />
        <path d={`M0,${height} ${points}`} fill="none" stroke={COLORS.success} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </Box>
  );
}

// --- DIÁLOGOS ---

function RestaurantDialog({ open, onClose, restaurant, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    owner_email: '',
    is_demo: false,
    suscripcion: 'basic'
  });

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || '',
        slug: restaurant.slug || '',
        owner_email: restaurant.owner_email || '',
        is_demo: restaurant.is_demo || false,
        suscripcion: restaurant.suscripcion || 'basic'
      });
    } else {
      setFormData({ name: '', slug: '', owner_email: '', is_demo: false, suscripcion: 'basic' });
    }
  }, [restaurant, open]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>{restaurant ? 'Editar Restaurante' : 'Nuevo Restaurante'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            label="Nombre del Restaurante"
            name="name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            required
            variant="outlined"
          />
          <TextField
            label="Slug (URL)"
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            fullWidth
            helperText="Identificador único en la URL (ej: mcdonalds)"
            required
            disabled={!!restaurant}
            InputProps={{ startAdornment: <InputAdornment position="start">/</InputAdornment> }}
          />
          <TextField
            label="Email del Dueño"
            name="owner_email"
            value={formData.owner_email}
            onChange={handleChange}
            fullWidth
            type="email"
            helperText="Usuario que tendrá acceso de administración"
          />
          <TextField
            select
            label="Plan Inicial (Legacy)"
            name="suscripcion"
            value={formData.suscripcion}
            onChange={handleChange}
            fullWidth
            helperText="Se sincronizará automáticamente al registrar pagos."
          >
            <MenuItem value="basic">Basic (Gratis)</MenuItem>
            <MenuItem value="pro">Pro</MenuItem>
            <MenuItem value="ultra">Ultra</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onSave(formData)}
          startIcon={<SaveIcon />}
        >
          Guardar Cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SubscriptionDialog({ open, onClose, restaurantes, initialRestaurantId, onSave }) {
  const [formData, setFormData] = useState({
    restaurante: initialRestaurantId || '',
    plan: 'pro',
    status: 'active',
    amount: 29900,
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (initialRestaurantId) {
      setFormData(prev => ({ ...prev, restaurante: initialRestaurantId }));
    }
  }, [initialRestaurantId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    if (e.target.name === 'plan') {
      let amount = 0;
      if (e.target.value === 'pro') amount = 29900;
      if (e.target.value === 'ultra') amount = 59900;
      setFormData(prev => ({ ...prev, plan: e.target.value, amount }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptIcon color="primary" />
        <Typography variant="h6">Registrar Pago / Renovar</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          Esta acción generará una factura en el historial y actualizará el plan del restaurante automáticamente.
        </Alert>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            select
            label="Restaurante"
            name="restaurante"
            value={formData.restaurante}
            onChange={handleChange}
            fullWidth
            required
            disabled={!!initialRestaurantId}
          >
            {restaurantes.map(r => (
              <MenuItem key={r.id} value={r.id}>{r.name} ({r.slug})</MenuItem>
            ))}
          </TextField>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              label="Plan Contratado"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              fullWidth
            >
              <MenuItem value="basic">Basic (Gratuitos)</MenuItem>
              <MenuItem value="pro">Pro ($29.900)</MenuItem>
              <MenuItem value="ultra">Ultra ($59.900)</MenuItem>
              <MenuItem value="custom">Custom (Empresarial)</MenuItem>
            </TextField>
            <TextField
              label="Monto Cobrado"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Box>

          <TextField
            label="Próximo Vencimiento (30 días)"
            name="nextBillingDate"
            type="date"
            value={formData.nextBillingDate}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Define cuándo el sistema debería esperar el próximo pago."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button variant="contained" onClick={() => onSave(formData)} color="success" size="large">
          Confirmar Pago
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ==============================
// MAIN COMPONENT
// ==============================
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { restaurantes, loading, error, refetch } = useRestaurantes();
  const [activeTab, setActiveTab] = useState(0);

  const [openRestDialog, setOpenRestDialog] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);

  const [openSubDialog, setOpenSubDialog] = useState(false);
  const [selectedRestForSub, setSelectedRestForSub] = useState(null);

  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTargetRestaurant, setMenuTargetRestaurant] = useState(null);
  const openMenu = Boolean(anchorEl);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // --- DERIVED DATA ---

  const billingHistory = useMemo(() => {
    if (!restaurantes) return [];
    const history = restaurantes.flatMap(r =>
      (r.subscriptions || []).map(sub => ({
        ...sub,
        restaurantName: r.name,
        restaurantSlug: r.slug,
        ownerEmail: r.owner_email || 'N/A'
      }))
    );
    return history.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
  }, [restaurantes]);

  const revenueData = useMemo(() => {
    const months = {};
    billingHistory.forEach(tx => {
      const date = new Date(tx.createdAt || tx.startDate);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      months[key] = (months[key] || 0) + Number(tx.amount || 0);
    });
    return Object.entries(months).map(([date, amount]) => ({ date, amount })).reverse().slice(0, 6).reverse();
  }, [billingHistory]);

  const kpis = useMemo(() => {
    if (!restaurantes) return { total: 0, mrr: 0, active: 0, users: 0 };
    let mrr = 0;
    const activeThreshold = 7 * 24 * 3600 * 1000;
    let activeCount = 0;
    let usersCount = 0;

    restaurantes.forEach(r => {
      const activeSub = r.subscriptions?.find(s => s.status === 'active');
      if (activeSub) {
        mrr += Number(activeSub.amount || 0);
      } else {
        if (r.suscripcion === 'pro') mrr += 29900;
        if (r.suscripcion === 'ultra') mrr += 59900;
      }

      if (new Date(r.updatedAt).getTime() > Date.now() - activeThreshold) activeCount++;
      usersCount += Number(r.restaurant_members || 0);
    });

    return {
      total: restaurantes.length,
      mrr: mrr.toLocaleString('es-AR'),
      active: activeCount,
      users: usersCount
    };
  }, [restaurantes]);

  // --- HANDLERS ---

  const handleMenuClick = (event, restaurant) => {
    setAnchorEl(event.currentTarget);
    setMenuTargetRestaurant(restaurant);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTargetRestaurant(null);
  };

  const handleSaveRestaurant = async (data) => {
    try {
      const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
      const headers = { Authorization: `Bearer ${token}` };

      if (editingRestaurant) {
        await axios.put(`${API_URL}/restaurantes/${editingRestaurant.id}`, { data }, { headers });
      } else {
        await axios.post(`${API_URL}/restaurantes`, { data }, { headers });
      }
      setOpenRestDialog(false);
      setEditingRestaurant(null);
      refetch();
    } catch (e) {
      console.error(e);
      alert('Error: ' + (e.response?.data?.error?.message || e.message));
    }
  };

  const handleDeleteRestaurant = async () => {
    const id = menuTargetRestaurant?.id;
    if (!id) return;
    if (!window.confirm(`¿⚠️ Estás seguro de eliminar ${menuTargetRestaurant.name}? Esta acción es irreversible.`)) return;

    try {
      const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
      await axios.delete(`${API_URL}/restaurantes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      handleMenuClose();
      refetch();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleSaveSubscription = async (data) => {
    try {
      const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        data: {
          restaurante: data.restaurante,
          plan: data.plan,
          amount: Number(data.amount),
          status: 'active',
          startDate: new Date(),
          nextBillingDate: new Date(data.nextBillingDate)
        }
      };
      await axios.post(`${API_URL}/subscriptions`, payload, { headers });

      let legacyPlan = 'basic';
      if (['basic', 'pro', 'ultra'].includes(data.plan)) {
        legacyPlan = data.plan;
      }

      await axios.put(`${API_URL}/restaurantes/${data.restaurante}`, {
        data: { suscripcion: legacyPlan }
      }, { headers });

      setOpenSubDialog(false);
      refetch();
      alert(`✅ Pago registrado y plan ${data.plan.toUpperCase()} activado exitosamente.`);
    } catch (e) {
      console.error(e);
      alert('Error al registrar pago: ' + (e.response?.data?.error?.message || e.message));
    }
  };

  const handleImpersonate = async (r = menuTargetRestaurant) => {
    if (!r?.owner_email) {
      alert('Este restaurante no tiene un email de dueño asignado. Editálo primero.');
      return;
    }

    try {
      const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
      const res = await axios.post(`${API_URL}/restaurantes/impersonate`,
        { email: r.owner_email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newItempersonateToken = res.data.jwt;
      if (newItempersonateToken) {
        const url = `${window.location.origin}/admin/impersonate?token=${newItempersonateToken}&slug=${r.slug}`;
        window.open(url, '_blank');
      }
      handleMenuClose();
    } catch (e) {
      console.error(e);
      alert('Error al intentar acceder: ' + (e.response?.data?.error?.message || e.message));
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', height: '100vh', alignItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: 4,
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >

      {/* HEADER */}
      <Box sx={{
        mb: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        p: 3,
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: `1px solid ${COLORS.border}`,
        boxShadow: COLORS.shadow1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
            color="inherit"
            sx={{ borderRadius: 2 }}
          >
            Volver
          </Button>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', letterSpacing: -1 }}>
              Super Admin 3.0
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Plataforma de Control & Finanzas
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refetch} sx={{ borderRadius: 2 }}>
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditingRestaurant(null); setOpenRestDialog(true); }}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Nuevo Restaurante
          </Button>
        </Box>
      </Box>

      {/* KPIS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Flota Activa" value={kpis.total} subtitle="Restaurantes registrados" icon={<RestaurantIcon />} color={COLORS.secondary} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="MRR Mensual" value={`$${kpis.mrr}`} subtitle="Ingresos recurrentes" icon={<MoneyIcon />} color={COLORS.success} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Salud de Flota" value={kpis.active} subtitle="Locales activos (7d)" icon={<CheckCircleIcon />} color={COLORS.warning} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Usuarios" value={kpis.users} subtitle="Miembros de equipo" icon={<PeopleIcon />} color={COLORS.info} />
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <Card sx={{ mb: 3, borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow2, overflow: 'visible' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Gestión de Flota" icon={<DashboardIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
          <Tab label="Finanzas e Historial" icon={<ReceiptIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
          <Tab label="Centro de Comentarios" icon={<MessageIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
          <Tab label="Usuarios" icon={<PeopleIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
          <Tab label="Clientes app" icon={<ClientesIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
          <Tab label="Permisos" icon={<FilterIcon />} iconPosition="start" sx={{ fontWeight: 600, minHeight: 60 }} />
        </Tabs>

        {/* TAB 0: FLEET MANAGEMENT */}
        {activeTab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Restaurante</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Dueño / Contacto</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Plan Actual</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Estado Salud</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {restaurantes
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((r, i) => {
                      const daysInactive = Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / (1000 * 3600 * 24));
                      const health = daysInactive > 30 ? 'critical' : daysInactive > 7 ? 'warning' : 'healthy';

                      return (
                        <TableRow key={r.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar src={r.logo} sx={{ width: 44, height: 44, bgcolor: COLORS.bgAlt, fontSize: '1rem' }}>{r.name?.[0]}</Avatar>
                              <Box>
                                <Typography fontWeight={700} variant="body2" sx={{ color: COLORS.text }}>{r.name}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: COLORS.bgAlt, px: 0.5, borderRadius: 0.5, color: COLORS.textSecondary }}>
                                    {r.slug}
                                  </Typography>
                                  {r.is_demo && <Chip label="DEMO" size="small" color="info" sx={{ height: 16, fontSize: '0.6rem' }} />}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} sx={{ color: COLORS.textSecondary }}>{r.owner_email || '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">{(r.restaurant_members || 0) + ' miembros'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Chip
                                label={String(r.suscripcion || 'basic').toUpperCase()}
                                color={r.suscripcion === 'ultra' ? 'secondary' : r.suscripcion === 'pro' ? 'primary' : 'default'}
                                size="small"
                                icon={r.suscripcion === 'ultra' ? <StarIcon /> : undefined}
                                sx={{ fontWeight: 700, borderRadius: 1.5 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <HealthBadge status={health} />
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                              {daysInactive === 0 ? 'Activo hoy' : `${daysInactive}d inactivo`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton onClick={(e) => handleMenuClick(e, r)} size="small" sx={{ color: COLORS.textMuted }}>
                              <MoreVertIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={restaurantes.length}
                page={page}
                onPageChange={(e, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              />
            </TableContainer>
          </motion.div>
        )}

        {/* TAB 1: FINANCES AND HISTORY */}
        {activeTab === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Box sx={{ p: 4 }}>

              {/* Revenue Header */}
              <Grid container spacing={4} sx={{ mb: 4 }}>
                <Grid item xs={12} md={8}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight={700}>Tendencia de Ingresos</Typography>
                    <Chip icon={<TrendingUpIcon />} label="+12% vs mes anterior" color="success" size="small" variant="outlined" />
                  </Box>
                  <RevenueChart data={revenueData} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%', bgcolor: COLORS.bgAlt, borderStyle: 'dashed' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenSubDialog(true)}
                        sx={{ mb: 2, borderRadius: 4, px: 4 }}
                      >
                        Registrar Pago Manual
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Ideal para pagos por transferencia o efectivo fuera de la plataforma.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              {/* Transactions Table */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Historial de Transacciones (Global)</Typography>
                <Button startIcon={<DownloadIcon />} size="small">Exportar CSV</Button>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Restaurante</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Concepto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Monto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {billingHistory.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No hay transacciones registradas.</TableCell></TableRow>
                    ) : (
                      billingHistory.map((tx, idx) => (
                        <TableRow key={tx.id || idx} hover>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{formatDate(tx.createdAt || tx.startDate)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{tx.restaurantName}</Typography>
                            <Typography variant="caption" color="text.secondary">{tx.ownerEmail}</Typography>
                          </TableCell>
                          <TableCell>
                            Plan {tx.plan?.toUpperCase()}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: COLORS.text }}>
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell>
                            <Chip label="Completado" size="small" color="success" variant="outlined" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </motion.div>
        )}

        {/* TAB 2: COMMENTS */}
        {activeTab === 2 && <CommentsList />}

        {/* TAB 3: USERS */}
        {activeTab === 3 && <UsersPanel restaurantes={restaurantes || []} />}
        {activeTab === 4 && <CustomersPanel restaurantes={restaurantes || []} />}
        {activeTab === 5 && <PermissionsPanel />}
      </Card>

      {/* MENÚ DE ACCIONES RÁPIDAS */}
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        PaperProps={{ elevation: 0, sx: { minWidth: 220, borderRadius: 2, mt: 1, border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow4 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleImpersonate(menuTargetRestaurant)}>
          <ListItemIcon><LoginIcon fontSize="small" sx={{ color: COLORS.secondary }} /></ListItemIcon>
          <ListItemText primary="Entrar como dueño" primaryTypographyProps={{ fontWeight: 500 }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          setSelectedRestForSub(menuTargetRestaurant?.id);
          setOpenSubDialog(true);
          handleMenuClose();
        }}>
          <ListItemIcon><ReceiptIcon fontSize="small" sx={{ color: COLORS.success }} /></ListItemIcon>
          <ListItemText primary="Registrar Cobro" secondary="Sincroniza plan" />
        </MenuItem>
        <MenuItem onClick={() => {
          setEditingRestaurant(menuTargetRestaurant);
          setOpenRestDialog(true);
          handleMenuClose();
        }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Editar Detalles" />
        </MenuItem>
        <MenuItem onClick={handleDeleteRestaurant} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Eliminar Restaurante" />
        </MenuItem>
      </Menu>

      {/* DIALOGS */}
      <RestaurantDialog
        open={openRestDialog}
        onClose={() => setOpenRestDialog(false)}
        restaurant={editingRestaurant}
        onSave={handleSaveRestaurant}
      />

      <SubscriptionDialog
        open={openSubDialog}
        onClose={() => setOpenSubDialog(false)}
        restaurantes={restaurantes}
        initialRestaurantId={selectedRestForSub}
        onSave={handleSaveSubscription}
      />

    </Container>
  );
}

// Subcomponente Usuarios
function UsersPanel({ restaurantes }) {
  const [users, setUsers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState(0);

  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(null);
  const [resetPwDialog, setResetPwDialog] = useState(null);
  const [memberDialog, setMemberDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newUser, setNewUser] = useState({ email: '', fullname: '', password: '' });
  const [editForm, setEditForm] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [newMember, setNewMember] = useState({ userId: '', restauranteId: '', role: 'staff' });
  const [detailUserId, setDetailUserId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({ search: search || undefined, pageSize: 200 });
      setUsers(data || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al cargar usuarios');
    }
    setLoading(false);
  };

  const loadMemberships = async () => {
    try {
      const data = await fetchAdminMemberships({ pageSize: 500 });
      setMemberships(data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadUsers(); loadMemberships(); }, []);

  const handleSearch = () => loadUsers();

  const handleCreate = async () => {
    if (!newUser.email || !newUser.password) return;
    setSaving(true);
    try {
      await createAdminUser(newUser);
      setCreateDialog(false);
      setNewUser({ email: '', fullname: '', password: '' });
      await loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al crear usuario');
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      await updateAdminUser(editDialog.id, editForm);
      setEditDialog(null);
      await loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al editar usuario');
    }
    setSaving(false);
  };

  const handleToggleBlock = async (user) => {
    try {
      await toggleBlockUser(user.id);
      await loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error');
    }
  };

  const handleResetPw = async () => {
    if (!resetPwDialog || !newPassword) return;
    setSaving(true);
    try {
      await resetUserPassword(resetPwDialog.id, newPassword);
      setResetPwDialog(null);
      setNewPassword('');
      alert('Password actualizada correctamente');
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al resetear password');
    }
    setSaving(false);
  };

  const handleToggleMemberActive = async (m) => {
    try {
      await updateMembership(m.id, { active: !m.active });
      await loadMemberships();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error');
    }
  };

  const handleChangeMemberRole = async (m, newRole) => {
    try {
      await updateMembership(m.id, { role: newRole });
      await loadMemberships();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error');
    }
  };

  const handleCreateMember = async () => {
    if (!newMember.userId || !newMember.restauranteId) return;
    setSaving(true);
    try {
      await createMembership(newMember);
      setMemberDialog(false);
      setNewMember({ userId: '', restauranteId: '', role: 'staff' });
      await loadMemberships();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Error al crear membership');
    }
    setSaving(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Usuarios (${users.length})`} sx={{ fontWeight: 600 }} />
        <Tab label={`Memberships (${memberships.length})`} sx={{ fontWeight: 600 }} />
      </Tabs>

      {subTab === 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField size="small" placeholder="Buscar por email, nombre..." value={search}
              onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={handleSearch}>Buscar</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>Nuevo usuario</Button>
          </Stack>

          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box> : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Rol Strapi</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Provider</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Restaurantes</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Creado</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3 }}>Sin usuarios</TableCell></TableRow>
                  )}
                  {users.map(u => (
                    <TableRow
                      key={u.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setDetailUserId(u.id)}
                    >
                      <TableCell>{u.id}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{u.fullname || u.username || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.email}</TableCell>
                      <TableCell>
                        <Chip label={u.role?.name || '—'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell><Chip label={u.provider || 'local'} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        {u.blocked ? <Chip label="Bloqueado" color="error" size="small" /> :
                          u.confirmed ? <Chip label="Activo" color="success" size="small" /> :
                          <Chip label="No confirmado" color="warning" size="small" />}
                      </TableCell>
                      <TableCell>
                        {(u.restaurant_members || []).filter(m => m.active).map(m => (
                          <Chip key={m.id} label={`${m.restaurante?.name || '?'} (${m.role})`}
                            size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                        {(u.restaurant_members || []).filter(m => m.active).length === 0 && <Typography variant="caption" color="text.secondary">Sin acceso</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{formatDate(u.createdAt)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Ver detalle, fidelización y panel">
                          <Button size="small" variant="outlined" sx={{ mr: 0.5, textTransform: 'none' }} onClick={() => setDetailUserId(u.id)}>
                            Ver
                          </Button>
                        </Tooltip>
                        <Tooltip title="Editar rápido"><IconButton size="small" onClick={() => { setEditDialog(u); setEditForm({ fullname: u.fullname || '', email: u.email, username: u.username }); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title={u.blocked ? 'Desbloquear' : 'Bloquear'}><IconButton size="small" color={u.blocked ? 'success' : 'error'} onClick={() => handleToggleBlock(u)}>{u.blocked ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}</IconButton></Tooltip>
                        <Tooltip title="Resetear password"><IconButton size="small" onClick={() => { setResetPwDialog(u); setNewPassword(''); }}><EditIcon fontSize="small" sx={{ color: COLORS.warning }} /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {subTab === 1 && (
        <>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMemberDialog(true)}>Asignar usuario a restaurante</Button>
          </Stack>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Restaurante</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rol</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {memberships.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Sin memberships</TableCell></TableRow>
                )}
                {memberships.map(m => (
                  <TableRow key={m.id} hover sx={{ opacity: m.active ? 1 : 0.5 }}>
                    <TableCell sx={{ fontWeight: 500 }}>{m.users_permissions_user?.fullname || m.users_permissions_user?.username || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{m.users_permissions_user?.email || '-'}</TableCell>
                    <TableCell>{m.restaurante?.name || '-'} <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>({m.restaurante?.slug})</Typography></TableCell>
                    <TableCell>
                      <TextField select size="small" value={m.role} onChange={e => handleChangeMemberRole(m, e.target.value)}
                        sx={{ minWidth: 100 }} variant="standard">
                        <MenuItem value="owner">Owner</MenuItem>
                        <MenuItem value="staff">Staff</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Chip label={m.active ? 'Activo' : 'Inactivo'} color={m.active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" color={m.active ? 'error' : 'success'} onClick={() => handleToggleMemberActive(m)}>
                        {m.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <UserDetailDialog
        userId={detailUserId}
        open={Boolean(detailUserId)}
        onClose={() => setDetailUserId(null)}
        onUpdated={() => { loadUsers(); loadMemberships(); }}
      />

      {/* Dialog Crear Usuario */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear usuario nuevo</DialogTitle>
        <DialogContent>
          <TextField label="Email" fullWidth margin="normal" required value={newUser.email}
            onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))} />
          <TextField label="Nombre completo" fullWidth margin="normal" value={newUser.fullname}
            onChange={e => setNewUser(f => ({ ...f, fullname: e.target.value }))} />
          <TextField label="Password" type="password" fullWidth margin="normal" required value={newUser.password}
            onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} helperText="Mínimo 6 caracteres" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !newUser.email || !newUser.password}>
            {saving ? 'Creando...' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Editar Usuario */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar usuario: {editDialog?.email}</DialogTitle>
        <DialogContent>
          <TextField label="Nombre completo" fullWidth margin="normal" value={editForm.fullname || ''}
            onChange={e => setEditForm(f => ({ ...f, fullname: e.target.value }))} />
          <TextField label="Email" fullWidth margin="normal" value={editForm.email || ''}
            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          <TextField label="Username" fullWidth margin="normal" value={editForm.username || ''}
            onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Resetear Password */}
      <Dialog open={!!resetPwDialog} onClose={() => setResetPwDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Resetear password: {resetPwDialog?.email}</DialogTitle>
        <DialogContent>
          <TextField label="Nueva password" type="password" fullWidth margin="normal" autoFocus
            value={newPassword} onChange={e => setNewPassword(e.target.value)} helperText="Mínimo 6 caracteres" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPwDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleResetPw} disabled={saving || newPassword.length < 6}>
            {saving ? 'Reseteando...' : 'Resetear password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Asignar Membership */}
      <Dialog open={memberDialog} onClose={() => setMemberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar usuario a restaurante</DialogTitle>
        <DialogContent>
          <TextField label="ID del usuario" type="number" fullWidth margin="normal" required
            value={newMember.userId} onChange={e => setNewMember(f => ({ ...f, userId: e.target.value }))}
            helperText="Copiá el ID de la tabla de usuarios" />
          <TextField label="Restaurante" select fullWidth margin="normal" required
            value={newMember.restauranteId} onChange={e => setNewMember(f => ({ ...f, restauranteId: e.target.value }))}>
            {restaurantes.map(r => <MenuItem key={r.id} value={r.id}>{r.name} ({r.slug})</MenuItem>)}
          </TextField>
          <TextField label="Rol" select fullWidth margin="normal"
            value={newMember.role} onChange={e => setNewMember(f => ({ ...f, role: e.target.value }))}>
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateMember} disabled={saving || !newMember.userId || !newMember.restauranteId}>
            {saving ? 'Asignando...' : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PermissionsPanel() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [detailUserId, setDetailUserId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchPermissionsOverview({
        search: search || undefined,
        filter: filter || undefined,
        page: page + 1,
        pageSize,
      });
      setRows(res?.data || []);
      setMeta(res?.meta || null);
    } catch (e) {
      console.error(e);
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, pageSize, filter]);

  const exportCsv = () => {
    const header = ['email', 'strapiRole', 'superAdmin', 'memberships', 'legacyOwner', 'blocked'];
    const lines = rows.map((r) => [
      r.email,
      r.strapiRole || '',
      r.isPlatformAdmin ? 'yes' : 'no',
      (r.memberships || []).map((m) => `${m.name}:${m.role}`).join('; '),
      (r.legacyOwnerRestaurants || []).map((x) => x.name).join('; '),
      r.blocked ? 'yes' : 'no',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mozoqr-permisos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }} alignItems="center">
        <TextField size="small" label="Buscar email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <TextField size="small" select label="Filtro" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="owners">Solo owners</MenuItem>
          <MenuItem value="superadmin">Super admins</MenuItem>
          <MenuItem value="blocked">Bloqueados</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => { setPage(0); load(); }}>Buscar</Button>
        <Button startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!rows.length}>Exportar CSV</Button>
        {meta?.stats && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {meta.stats.totalUsers} usuarios · {meta.stats.platformAdmins} super admin(s)
          </Typography>
        )}
      </Stack>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: COLORS.bgAlt }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rol Strapi</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Super Admin</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Restaurantes (membership)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Legacy owner_email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bloqueado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailUserId(r.id)}>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.strapiRole || '-'}</TableCell>
                    <TableCell>{r.isPlatformAdmin ? <Chip label="Sí" color="primary" size="small" /> : '-'}</TableCell>
                    <TableCell>
                      {(r.memberships || []).map((m, i) => (
                        <Chip key={i} size="small" label={`${m.name} (${m.role})`} sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>
                      {(r.legacyOwnerRestaurants || []).map((x, i) => (
                        <Chip key={i} size="small" color="warning" variant="outlined" label={x.name} sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>{r.blocked ? <Chip label="Sí" color="error" size="small" /> : 'No'}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" variant="outlined" sx={{ textTransform: 'none' }} onClick={() => setDetailUserId(r.id)}>
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <UserDetailDialog
            userId={detailUserId}
            open={Boolean(detailUserId)}
            onClose={() => setDetailUserId(null)}
            onUpdated={load}
          />
          <TablePagination
            count={meta?.pagination?.total || 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="Filas"
          />
        </>
      )}
    </Box>
  );
}

// Subcomponente Comentarios
function CommentsList() {
  const [comments, setComments] = useState([]);
  useEffect(() => { getAllOwnerComments({}).then(setComments).catch(console.error); }, []);
  return (
    <Box>
      {comments.length === 0 ? <Box p={3}><Typography color="text.secondary">No hay comentarios aún.</Typography></Box> :
        comments.map(c => (
          <Box key={c.id} sx={{ p: 2, borderBottom: `1px solid ${COLORS.border}`, bgcolor: 'background.paper', '&:hover': { bgcolor: COLORS.bgAlt } }}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>{c.restaurantName}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDate(c.createdAt)}</Typography>
            </Box>
            <Typography variant="body2" color="text.primary">"{c.comment}"</Typography>
          </Box>
        ))
      }
    </Box>
  );
}
