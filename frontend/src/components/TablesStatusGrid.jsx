// frontend/src/components/TablesStatusGrid.jsx
import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Chip, Tooltip } from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { MARANA_COLORS } from '../theme';

/**
 * Componente para mostrar el estado de las mesas en tiempo real
 */
export default function TablesStatusGrid({ tables = [], orders = [], onTableClick }) {
  // Agrupar pedidos por mesa
  const ordersByTable = React.useMemo(() => {
    try {
      const map = new Map();
      if (Array.isArray(orders)) {
        orders.forEach(order => {
          const tableNum = order?.mesa || order?.tableNumber || '—';
          if (tableNum !== '—') {
            if (!map.has(tableNum)) {
              map.set(tableNum, []);
            }
            map.get(tableNum).push(order);
          }
        });
      }
      return map;
    } catch (error) {
      console.error('Error grouping orders by table:', error);
      return new Map();
    }
  }, [orders]);

  /**
   * Genera color del gradiente basado en nivel de actividad
   * Azul (baja) → Verde → Amarillo → Naranja → Rojo (alta)
   */
  const getActivityColor = (activeOrdersCount) => {
    if (activeOrdersCount === 0) return '#3B82F6'; // Azul - sin actividad
    if (activeOrdersCount === 1) return '#10B981'; // Verde - baja actividad
    if (activeOrdersCount === 2) return '#84CC16'; // Verde amarillento - media
    if (activeOrdersCount === 3) return '#F59E0B'; // Naranja - alta
    return '#EF4444'; // Rojo - muy alta (4+ pedidos)
  };

  // Determinar estado de cada mesa
  const getTableStatus = (table) => {
    const tableOrders = ordersByTable.get(table.number) || [];
    const activeOrders = tableOrders.filter(o => 
      o.order_status === 'pending' || 
      o.order_status === 'preparing' || 
      o.order_status === 'served'
    );

    const activeOrdersCount = activeOrders.length;
    const activityColor = getActivityColor(activeOrdersCount);

    if (activeOrdersCount === 0) {
      return { 
        status: 'free', 
        label: 'Libre', 
        color: activityColor, 
        icon: <CheckCircleIcon /> 
      };
    }

    const hasPending = activeOrders.some(o => o.order_status === 'pending');
    const hasPreparing = activeOrders.some(o => o.order_status === 'preparing');
    const hasServed = activeOrders.some(o => o.order_status === 'served');

    if (hasServed && !hasPending && !hasPreparing) {
      return { 
        status: 'waiting', 
        label: 'Esperando cuenta', 
        color: activityColor, 
        icon: <AccessTimeIcon /> 
      };
    }

    if (hasPending || hasPreparing) {
      return { 
        status: 'occupied', 
        label: 'Ocupada', 
        color: activityColor, 
        icon: <RestaurantIcon /> 
      };
    }

    return { 
      status: 'free', 
      label: 'Libre', 
      color: activityColor, 
      icon: <CheckCircleIcon /> 
    };
  };

  if (tables.length === 0) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          border: `1px solid ${MARANA_COLORS.border}`,
          p: 4,
          textAlign: 'center'
        }}
      >
        <TableRestaurantIcon sx={{ fontSize: 48, color: MARANA_COLORS.textSecondary, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          No hay mesas configuradas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configura tus mesas para comenzar a recibir pedidos
        </Typography>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${MARANA_COLORS.border}`,
        background: 'linear-gradient(135deg, #ffffff 0%, #fafbfc 100%)',
        p: 3
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Estado de Mesas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista en tiempo real del estado de tus mesas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600, mr: 0.5 }}>
              Baja interacción
            </Typography>
            <Box 
              sx={{ 
                width: 60,
                height: 6,
                borderRadius: 1,
                background: 'linear-gradient(to right, #3B82F6 0%, #10B981 25%, #84CC16 50%, #F59E0B 75%, #EF4444 100%)',
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', fontWeight: 600, ml: 0.5 }}>
              Alta interacción
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {tables.map((table) => {
          const tableStatus = getTableStatus(table);
          const tableOrders = ordersByTable.get(table.number) || [];
          const activeOrdersCount = tableOrders.filter(o => 
            o.order_status !== 'paid'
          ).length;

          return (
            <Grid item xs={6} sm={4} md={3} key={table.id || table.number}>
              <Card
                elevation={0}
                onClick={() => onTableClick && onTableClick(table)}
                sx={{
                  border: `2px solid ${tableStatus.color}40`,
                  borderRadius: 2,
                  p: 2,
                  textAlign: 'center',
                  cursor: onTableClick ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  background: tableStatus.status === 'free' 
                    ? 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
                    : `linear-gradient(135deg, ${tableStatus.color}08 0%, ${tableStatus.color}03 100%)`,
                  '&:hover': onTableClick ? {
                    transform: 'translateY(-2px)',
                    boxShadow: `0px 8px 24px ${tableStatus.color}25`,
                    borderColor: tableStatus.color
                  } : {}
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1
                  }}
                >
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: `${tableStatus.color}15`,
                      color: tableStatus.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <TableRestaurantIcon />
                  </Box>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Mesa {table.number || table.name || '—'}
                </Typography>

                <Chip
                  icon={tableStatus.icon}
                  label={tableStatus.label}
                  size="small"
                  sx={{
                    bgcolor: `${tableStatus.color}15`,
                    color: tableStatus.color,
                    fontWeight: 600,
                    mb: 1
                  }}
                />

                {activeOrdersCount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {activeOrdersCount} pedido{activeOrdersCount > 1 ? 's' : ''} activo{activeOrdersCount > 1 ? 's' : ''}
                  </Typography>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Card>
  );
}
