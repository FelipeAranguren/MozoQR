// frontend/src/components/owner/OwnerSidebar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import SettingsIcon from '@mui/icons-material/Settings';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BuildIcon from '@mui/icons-material/Build';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const menuItems = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/owner/:slug/dashboard',
  },
  {
    label: 'Menú',
    icon: <RestaurantMenuIcon />,
    path: '/owner/:slug/menu',
  },
  {
    label: 'Mesas',
    icon: <TableRestaurantIcon />,
    path: '/owner/:slug/tables',
  },
  {
    label: 'Configuración',
    icon: <SettingsIcon />,
    path: '/owner/:slug/settings',
  },
  {
    label: 'Plan',
    icon: <CreditCardIcon />,
    path: '/owner/:slug/plan',
  },
  {
    label: 'IA Integrada',
    icon: <PsychologyIcon />,
    path: '/owner/:slug/ai',
  },
  {
    label: 'Panel Avanzado',
    icon: <BuildIcon />,
    path: '/owner/:slug/advanced',
  },
];

export default function OwnerSidebar({ slug, onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [copySnack, setCopySnack] = React.useState(false);

  const menuUrl = typeof window !== 'undefined' ? `${window.location.origin}/${slug}/menu` : '';
  const handleCopyMenuLink = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(menuUrl).then(() => setCopySnack(true));
  };

  const handleNavigation = (path) => {
    const finalPath = path.replace(':slug', slug);
    navigate(finalPath);
    onNavigate?.();
  };

  const isActive = (path) => {
    const finalPath = path.replace(':slug', slug);
    return location.pathname === finalPath || location.pathname.startsWith(finalPath + '/');
  };

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Panel Owner
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
          {slug || 'Restaurante'}
        </Typography>
      </Box>

      <List sx={{ pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
                py: 1.25,
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.main',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive(item.path) ? 'primary.contrastText' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={() => { window.open(`/${slug}/menu`, '_blank', 'noopener,noreferrer'); onNavigate?.(); }}
          sx={{
            borderRadius: 1,
            mb: 1,
            py: 1.25,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Ver menú público" secondary="Nueva pestaña" primaryTypographyProps={{ fontSize: '0.9rem' }} />
          <Tooltip title="Copiar link">
            <IconButton size="small" onClick={handleCopyMenuLink} sx={{ ml: 0.5 }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemButton>
        <ListItemButton
          onClick={() => { navigate(`/staff/${slug}/orders`); onNavigate?.(); }}
          sx={{
            borderRadius: 1,
            mb: 1,
            py: 1.25,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <PointOfSaleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mostrador" secondary="Pedidos y cobros" primaryTypographyProps={{ fontSize: '0.9rem' }} />
        </ListItemButton>
        <ListItemButton
          onClick={() => { navigate('/owner'); onNavigate?.(); }}
          sx={{
            borderRadius: 1,
            py: 1.25,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="Mis Restaurantes" />
        </ListItemButton>
      </Box>

      <Snackbar
        open={copySnack}
        autoHideDuration={2000}
        onClose={() => setCopySnack(false)}
        message="Link copiado"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}