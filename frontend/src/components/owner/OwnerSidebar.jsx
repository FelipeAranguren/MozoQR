OwnerSidebar.jsx// frontend/src/components/owner/OwnerSidebar.jsx
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
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import SettingsIcon from '@mui/icons-material/Settings';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import BuildIcon from '@mui/icons-material/Build';

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
    label: 'Panel Avanzado',
    icon: <BuildIcon />,
    path: '/owner/:slug/advanced',
  },
];

export default function OwnerSidebar({ slug, currentPath }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path) => {
    const finalPath = path.replace(':slug', slug);
    navigate(finalPath);
  };

  const isActive = (path) => {
    const finalPath = path.replace(':slug', slug);
    return location.pathname === finalPath || location.pathname.startsWith(finalPath + '/');
  };

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Panel Owner
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {slug || 'Restaurante'}
        </Typography>
      </Box>

      <List sx={{ pt: 1 }}>
        {menuItems.map((item, index) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => handleNavigation(item.path)}
              sx={{
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
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={() => navigate('/owner')}
          sx={{
            borderRadius: 1,
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="Mis Restaurantes" />
        </ListItemButton>
      </Box>
    </Box>
  );
}