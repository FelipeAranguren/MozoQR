// frontend/src/components/owner/OwnerHeader.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Breadcrumbs,
  Link,
  Box,
  Button,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useAuth } from '../../context/AuthContext';

export default function OwnerHeader({ slug }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { user, logout } = auth || { user: null, logout: () => {} };

  // Generar breadcrumbs basado en la ruta actual
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Siempre incluir "Inicio"
    breadcrumbs.push({
      label: 'Inicio',
      path: '/',
      icon: <HomeIcon fontSize="small" />,
    });

    // Si estamos en /owner, mostrar "Mis Restaurantes"
    if (path === '/owner') {
      breadcrumbs.push({
        label: 'Mis Restaurantes',
        path: '/owner',
      });
      return breadcrumbs;
    }

    // Si estamos en una ruta de owner con slug
    if (parts[0] === 'owner' && slug) {
      breadcrumbs.push({
        label: 'Mis Restaurantes',
        path: '/owner',
      });

      // Agregar el restaurante
      breadcrumbs.push({
        label: slug,
        path: `/owner/${slug}/dashboard`,
      });

      // Agregar la sección actual
      if (parts.length > 2) {
        const section = parts[2];
        const sectionLabels = {
          dashboard: 'Dashboard',
          menu: 'Menú',
          tables: 'Mesas',
          settings: 'Configuración',
          plan: 'Plan',
          ai: 'IA Integrada',
          advanced: 'Panel Avanzado',
        };

        if (sectionLabels[section]) {
          breadcrumbs.push({
            label: sectionLabels[section],
            path: `/owner/${slug}/${section}`,
          });
        }
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleLogout = () => {
    logout();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow: 1,
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return isLast ? (
                <Typography key={crumb.path} color="text.primary" sx={{ fontWeight: 600 }}>
                  {crumb.icon && <Box component="span" sx={{ mr: 0.5, verticalAlign: 'middle' }}>{crumb.icon}</Box>}
                  {crumb.label}
                </Typography>
              ) : (
                <Link
                  key={crumb.path}
                  component="button"
                  variant="body1"
                  onClick={() => navigate(crumb.path)}
                  sx={{
                    color: 'text.secondary',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                    cursor: 'pointer',
                  }}
                >
                  {crumb.label}
                </Link>
              );
            })}
          </Breadcrumbs>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {user?.username || user?.email || 'Usuario'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleLogout}
            sx={{ textTransform: 'none' }}
          >
            Salir
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}