// frontend/src/components/HealthCheckPanel.jsx
import React, { useState } from 'react';
import { Box, Typography, LinearProgress, Card, Grid, Button, Collapse } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CategoryIcon from '@mui/icons-material/Category';
import ImageIcon from '@mui/icons-material/Image';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { MARANA_COLORS } from '../theme';

/**
 * Panel de Health Check - Muestra el estado de salud del restaurante (panel desplegable)
 */
export default function HealthCheckPanel({ metrics = {}, onActionClick }) {
  const [expanded, setExpanded] = useState(false);
  const {
    productsWithoutImage = 0,
    totalProducts = 0,
    outdatedPrices = 0,
    missingTables = 0,
    totalTables = 0,
    hasLogo = false,
    totalCategories = 0,
    productsWithoutCategory = 0
  } = metrics || {};

  // Calcular porcentajes
  const imageCoverage = totalProducts > 0 
    ? Math.round(((totalProducts - productsWithoutImage) / totalProducts) * 100) 
    : 100;
  
  const tableCoverage = totalTables > 0
    ? Math.round(((totalTables - missingTables) / totalTables) * 100)
    : 100;

  const categoryCoverage = totalProducts > 0
    ? Math.round(((totalProducts - productsWithoutCategory) / totalProducts) * 100)
    : 100;

  const healthItems = [
    {
      id: 'images',
      title: 'Productos con foto',
      value: `${imageCoverage}%`,
      progress: imageCoverage,
      status: imageCoverage >= 95 ? 'good' : imageCoverage >= 80 ? 'warning' : 'error',
      icon: <PhotoCameraIcon />,
      count: `${totalProducts - productsWithoutImage}/${totalProducts}`,
      action: productsWithoutImage > 0 ? 'Agregar fotos' : null
    },
    {
      id: 'prices',
      title: 'Precios actualizados',
      value: outdatedPrices === 0 ? '100%' : `${100 - Math.min(50, outdatedPrices * 10)}%`,
      progress: outdatedPrices === 0 ? 100 : Math.max(50, 100 - (outdatedPrices * 10)),
      status: outdatedPrices === 0 ? 'good' : outdatedPrices <= 2 ? 'warning' : 'error',
      icon: <AttachMoneyIcon />,
      count: outdatedPrices === 0 ? 'Todos actualizados' : `${outdatedPrices} desactualizados`,
      action: outdatedPrices > 0 ? 'Revisar precios' : null
    },
    {
      id: 'tables',
      title: 'Mesas configuradas',
      value: `${tableCoverage}%`,
      progress: tableCoverage,
      status: tableCoverage >= 90 ? 'good' : tableCoverage >= 70 ? 'warning' : 'error',
      icon: <TableRestaurantIcon />,
      count: `${totalTables - missingTables}/${totalTables}`,
      action: missingTables > 0 ? 'Configurar mesas' : null
    },
    {
      id: 'categories',
      title: 'Productos categorizados',
      value: `${categoryCoverage}%`,
      progress: categoryCoverage,
      status: categoryCoverage >= 90 ? 'good' : categoryCoverage >= 70 ? 'warning' : 'error',
      icon: <CategoryIcon />,
      count: `${totalProducts - productsWithoutCategory}/${totalProducts}`,
      action: productsWithoutCategory > 0 ? 'Organizar categorías' : null
    },
    {
      id: 'logo',
      title: 'Logo del restaurante',
      value: hasLogo ? '100%' : '0%',
      progress: hasLogo ? 100 : 0,
      status: hasLogo ? 'good' : 'error',
      icon: <ImageIcon />,
      count: hasLogo ? 'Configurado' : 'Sin logo',
      action: !hasLogo ? 'Agregar logo' : null
    }
  ];

  // Porcentaje global del Health Check (promedio de los 5 ítems)
  const overallPercent = Math.round(
    healthItems.reduce((sum, item) => sum + item.progress, 0) / healthItems.length
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return MARANA_COLORS.primary;
      case 'warning': return MARANA_COLORS.secondary;
      case 'error': return MARANA_COLORS.accent;
      default: return MARANA_COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'good': return <CheckCircleIcon sx={{ color: MARANA_COLORS.primary }} />;
      case 'warning': return <WarningIcon sx={{ color: MARANA_COLORS.secondary }} />;
      case 'error': return <ErrorIcon sx={{ color: MARANA_COLORS.accent }} />;
      default: return null;
    }
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        p: 3
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Health Check {overallPercent}%
          </Typography>
          <Collapse in={expanded}>
            <Typography variant="body2" color="text.secondary">
              Estado de configuración de tu restaurante
            </Typography>
          </Collapse>
        </Box>
        <Button
          size="small"
          onClick={() => setExpanded((e) => !e)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            color: MARANA_COLORS.primary,
            fontWeight: 600,
            textTransform: 'none'
          }}
        >
          {expanded ? 'mostrar menos' : 'mostrar más'}
        </Button>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        {healthItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${MARANA_COLORS.border}`,
                borderRadius: 2,
                p: 2,
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: `0px 4px 12px ${getStatusColor(item.status)}20`,
                  borderColor: `${getStatusColor(item.status)}40`
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      bgcolor: `${getStatusColor(item.status)}15`,
                      color: getStatusColor(item.status),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                      {item.count}
                    </Typography>
                  </Box>
                </Box>
                {getStatusIcon(item.status)}
              </Box>

              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: getStatusColor(item.status) }}>
                    {item.value}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={item.progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: `${MARANA_COLORS.border}40`,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      backgroundColor: getStatusColor(item.status),
                    }
                  }}
                />
              </Box>

              {item.action && onActionClick && (
                <Box
                  onClick={() => onActionClick(item.id)}
                  sx={{
                    mt: 1,
                    pt: 1,
                    borderTop: `1px solid ${MARANA_COLORS.border}40`,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: getStatusColor(item.status),
                      fontWeight: 600,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}
                  >
                    → {item.action}
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
        </Box>
      </Collapse>
    </Card>
  );
}

