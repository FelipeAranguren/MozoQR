
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
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  CloudDownload as DownloadIcon,
  FilterList as FilterIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useRestaurantes } from '../hooks/useRestaurantes';
import { getAllOwnerComments } from '../api/comments';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

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

// Componente para badge de salud
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

// Componente Tarjeta KPI
function StatCard({ title, value, subtitle, icon, color }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', boxShadow: 3 }}>
        <Box sx={{ position: 'absolute', top: -10, right: -10, opacity: 0.1, transform: 'scale(2.5)', color }}>
          {icon}
        </Box>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}20`, color: color, mr: 2, display: 'flex' }}>
              {icon}
            </Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5, color: '#1e293b' }}>
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

// Chart de Ingresos Simple (SVG)
function RevenueChart({ data }) {
  // data = [{ date: 'Jan', amount: 1000 }, ...]
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
            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`M0,${height} ${points} L${width},${height} Z`} fill="url(#grad)" />
        <path d={`M0,${height} ${points}`} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </Box>
  );
}

// --- DIÁLOGOS ---

// 1. Dialog Crear/Editar Restaurante
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
          sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
        >
          Guardar Cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 2. Dialog Registrar Pago / Suscripción
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

    // Auto-set amount logic
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

  // Estados para CRUD Restaurantes
  const [openRestDialog, setOpenRestDialog] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);

  // Estados para Suscripciones
  const [openSubDialog, setOpenSubDialog] = useState(false);
  const [selectedRestForSub, setSelectedRestForSub] = useState(null);

  // Menú de Acciones
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTargetRestaurant, setMenuTargetRestaurant] = useState(null);
  const openMenu = Boolean(anchorEl);

  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // --- DERIVED DATA ---

  // 1. All Transactions (Flattened History)
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
    // Sort by date desc
    return history.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
  }, [restaurantes]);

  // 2. Revenue Data for Chart (Last 6 months)
  const revenueData = useMemo(() => {
    const months = {};
    billingHistory.forEach(tx => {
      const date = new Date(tx.createdAt || tx.startDate);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`; // e.g., 12/2025
      months[key] = (months[key] || 0) + Number(tx.amount || 0);
    });
    // Convert to array
    return Object.entries(months).map(([date, amount]) => ({ date, amount })).reverse().slice(0, 6).reverse(); // Dummy logic for order
  }, [billingHistory]);

  // 3. KPIs
  const kpis = useMemo(() => {
    if (!restaurantes) return { total: 0, mrr: 0, active: 0, users: 0 };
    let mrr = 0;
    const activeThreshold = 7 * 24 * 3600 * 1000;
    let activeCount = 0;
    let usersCount = 0;

    restaurantes.forEach(r => {
      // MRR: Active subscription amount
      const activeSub = r.subscriptions?.find(s => s.status === 'active');
      if (activeSub) {
        mrr += Number(activeSub.amount || 0);
      } else {
        // Fallback checks
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
        // Update
        await axios.put(`${API_URL}/restaurantes/${editingRestaurant.id}`, { data }, { headers });
      } else {
        // Create
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

  // --- LOGICA CORE DE SINCRONIZACION ---
  const handleSaveSubscription = async (data) => {
    try {
      const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Crear el registro en 'subscriptions' (HISTORIAL)
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

      // 2. ACTUALIZAR 'restaurante.suscripcion' (Sincronización Legacy)
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
    <Container maxWidth="xl" sx={{ py: 4, bgcolor: '#f8fafc', minHeight: '100vh' }}>

      {/* HEADER */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
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
            <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: -1 }}>
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
            sx={{ bgcolor: '#0f172a', borderRadius: 2, px: 3, boxShadow: '0 4px 12px rgba(15,23,42,0.3)' }}
          >
            Nuevo Restaurante
          </Button>
        </Box>
      </Box>

      {/* KPIS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Flota Activa" value={kpis.total} subtitle="Restaurantes registrados" icon={<RestaurantIcon />} color="#3b82f6" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="MRR Mensual" value={`$${kpis.mrr}`} subtitle="Ingresos recurrentes" icon={<MoneyIcon />} color="#10b981" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Salud de Flota" value={kpis.active} subtitle="Locales activos (7d)" icon={<CheckCircleIcon />} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Usuarios" value={kpis.users} subtitle="Miembros de equipo" icon={<PeopleIcon />} color="#8b5cf6" />
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', overflow: 'visible' }}>
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
        </Tabs>

        {/* TAB 0: FLEET MANAGEMENT */}
        {activeTab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
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
                              <Avatar src={r.logo} sx={{ width: 44, height: 44, bgcolor: '#cbd5e1', fontSize: '1rem' }}>{r.name?.[0]}</Avatar>
                              <Box>
                                <Typography fontWeight={700} variant="body2" sx={{ color: '#0f172a' }}>{r.name}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.5, borderRadius: 0.5, color: '#64748b' }}>
                                    {r.slug}
                                  </Typography>
                                  {r.is_demo && <Chip label="DEMO" size="small" color="info" sx={{ height: 16, fontSize: '0.6rem' }} />}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} sx={{ color: '#334155' }}>{r.owner_email || '—'}</Typography>
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
                            <IconButton onClick={(e) => handleMenuClick(e, r)} size="small" sx={{ color: '#94a3b8' }}>
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
                  <Card variant="outlined" sx={{ height: '100%', bgcolor: '#f8fafc', borderStyle: 'dashed' }}>
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
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
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
                          <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
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
      </Card>

      {/* MENÚ DE ACCIONES RÁPIDAS (Igual que antes) */}
      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        PaperProps={{ elevation: 4, sx: { minWidth: 220, borderRadius: 2, mt: 1 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleImpersonate(menuTargetRestaurant)}>
          <ListItemIcon><LoginIcon fontSize="small" sx={{ color: '#3b82f6' }} /></ListItemIcon>
          <ListItemText primary="Entrar como dueño" primaryTypographyProps={{ fontWeight: 500 }} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          setSelectedRestForSub(menuTargetRestaurant?.id);
          setOpenSubDialog(true);
          handleMenuClose();
        }}>
          <ListItemIcon><ReceiptIcon fontSize="small" sx={{ color: '#10b981' }} /></ListItemIcon>
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

// Subcomponente Comentarios
function CommentsList() {
  const [comments, setComments] = useState([]);
  useEffect(() => { getAllOwnerComments({}).then(setComments).catch(console.error); }, []);
  return (
    <Box>
      {comments.length === 0 ? <Box p={3}><Typography color="text.secondary">No hay comentarios aún.</Typography></Box> :
        comments.map(c => (
          <Box key={c.id} sx={{ p: 2, borderBottom: '1px solid #f1f5f9', bgcolor: 'white', '&:hover': { bgcolor: '#f8fafc' } }}>
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
