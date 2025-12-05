// frontend/src/components/TablesStatusGridEnhanced.jsx
import React from 'react';
import { Box, Typography, Card, Grid, Chip, Tooltip, Badge } from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

/**
 * Componente mejorado para mostrar el estado de las mesas en tiempo real
 * Estados: disponible, ocupada, por limpiar, reservada, llamando
 */
export default function TablesStatusGridEnhanced({
  tables = [],
  orders = [],
  systemOrders = [],
  openSessions = [],
  onTableClick
}) {
  // Agrupar pedidos por mesa
  const ordersByTable = React.useMemo(() => {
    try {
      const map = new Map();
      if (Array.isArray(orders)) {
        orders.forEach(order => {
          const tableNum = order?.mesa_sesion?.mesa?.number || order?.mesa || order?.tableNumber || null;
          if (tableNum != null) {
            if (!map.has(tableNum)) {
              map.set(tableNum, []);
            }
            map.get(tableNum).push(order);
          }
        });
        // Log resumen para debugging
        if (orders.length > 0) {
          const summary = Array.from(map.entries()).map(([num, ords]) => ({
            mesa: num,
            total: ords.length,
            estados: ords.map(o => o.order_status).join(', ')
          }));
          console.log(`[TablesStatusGrid] ${orders.length} pedidos agrupados en ${map.size} mesa(s):`, summary);
        }
      }
      return map;
    } catch (error) {
      console.error('Error grouping orders by table:', error);
      return new Map();
    }
  }, [orders]);

  // Agrupar pedidos del sistema (llamadas de mozo) por mesa
  const systemOrdersByTable = React.useMemo(() => {
    try {
      const map = new Map();
      if (Array.isArray(systemOrders)) {
        systemOrders.forEach(order => {
          const tableNum = order?.mesa_sesion?.mesa?.number || order?.mesa || order?.tableNumber || null;
          if (tableNum != null) {
            if (!map.has(tableNum)) {
              map.set(tableNum, []);
            }
            map.get(tableNum).push(order);
          }
        });
      }
      return map;
    } catch (error) {
      console.error('Error grouping system orders by table:', error);
      return new Map();
    }
  }, [systemOrders]);

  /**
   * Determina el estado completo de una mesa
   * REGLAS CRÍTICAS:
   * 1. Si hay sesión abierta → Mesa OCUPADA (cliente sentado)
   * 2. Si hay pedidos sin pagar (pending, preparing, served) → Mesa OCUPADA
   * 3. Solo si no hay sesión ni pedidos sin pagar → respetar estado del backend
   */
  const getTableStatus = (table) => {
    const tableOrders = ordersByTable.get(table.number) || [];
    const systemCalls = systemOrdersByTable.get(table.number) || [];
    const hasOpenSession = openSessions.some((s) => {
      const matches = Number(s.mesaNumber) === Number(table.number);
      return matches;
    });

    // Pedidos sin pagar (cualquier estado que no sea 'paid')
    const unpaidOrders = tableOrders.filter(o => o.order_status !== 'paid');

    const hasSystemCall = systemCalls.length > 0;
    const hasServed = unpaidOrders.some(o => o.order_status === 'served');
    const hasPaid = tableOrders.some(o => o.order_status === 'paid');
    
    // LOG para debugging
    if (tableOrders.length > 0 || hasOpenSession) {
      console.log(`[TablesStatusGrid] Mesa ${table.number}: ${tableOrders.length} pedido(s), ${unpaidOrders.length} sin pagar, sesión abierta: ${hasOpenSession}`);
    }
    
    // REGLA CRÍTICA #1: Si hay sesión abierta, la mesa SIEMPRE está ocupada (cliente sentado)
    if (hasOpenSession) {
      console.log(`[TablesStatusGrid] Mesa ${table.number}: Tiene sesión abierta → FORZANDO estado OCUPADA`);
      return {
        status: 'occupied',
        label: 'Ocupada',
        color: '#1976d2', // Azul
        icon: <RestaurantIcon />,
        blinking: false,
        priority: 1,
        activeOrdersCount: unpaidOrders.length
      };
    }
    
    // REGLA CRÍTICA #2: Si hay pedidos sin pagar, la mesa SIEMPRE está ocupada
    if (unpaidOrders.length > 0) {
      console.log(`[TablesStatusGrid] Mesa ${table.number}: Tiene ${unpaidOrders.length} pedido(s) sin pagar (estados: ${unpaidOrders.map(o => o.order_status).join(', ')}) → FORZANDO estado OCUPADA`);
      return {
        status: 'occupied',
        label: hasServed && !hasPaid ? 'Espera pago' : 'Ocupada',
        color: '#1976d2', // Azul
        icon: hasServed && !hasPaid ? <AccessTimeIcon /> : <RestaurantIcon />,
        blinking: false,
        priority: 1,
        activeOrdersCount: unpaidOrders.length
      };
    }

    // PRIORIDAD 0: Estado por limpiar (máxima prioridad visual)
    if (table.status === 'por_limpiar') {
      return {
        status: 'needs-cleaning',
        label: 'Por limpiar',
        color: '#ff9800', // Naranja/Amber
        icon: <CleaningServicesIcon />,
        blinking: false,
        priority: 2
      };
    }

    // PRIORIDAD 1: Si hay llamada del sistema (mozo)
    if (hasSystemCall) {
      const callType = systemCalls[0];
      const isPayRequest = callType?.items?.some(item => {
        const prodName = (item?.product?.name || item?.name || '').toUpperCase();
        return prodName.includes('SOLICITUD DE COBRO') || prodName.includes('💳');
      }) || (callType?.customerNotes || '').toUpperCase().includes('SOLICITA COBRAR') || (callType?.customerNotes || '').toUpperCase().includes('CUENTA');

      if (isPayRequest) {
        return {
          status: 'request-payment',
          label: 'Solicita pago',
          color: '#9c27b0', // Púrpura
          icon: <AccountBalanceWalletIcon />,
          blinking: true,
          priority: 1
        };
      }

      return {
        status: 'calling',
        label: 'Llama mozo',
        color: '#ff1744', // Rojo vibrante
        icon: <NotificationsActiveIcon />,
        blinking: true,
        priority: 1
      };
    }


    // PRIORIDAD 5: Verificar estado del backend SOLO si no hay pedidos sin pagar ni sesión abierta
    // El backend es la fuente de verdad después de pagar
    if (table.status) {
      if (table.status === 'ocupada') {
        return {
          status: 'occupied',
          label: 'Ocupada',
          color: '#1976d2', // Azul
          icon: <RestaurantIcon />,
          blinking: false,
          priority: 3,
          activeOrdersCount: unpaidOrders.length
        };
      }
      
      if (table.status === 'disponible') {
        // Solo mostrar como disponible si TODOS los pedidos están pagados Y no hay sesión abierta
        const allOrdersPaid = tableOrders.length === 0 || tableOrders.every(o => o.order_status === 'paid');
        
        if (allOrdersPaid && !hasOpenSession) {
          console.log(`[TablesStatusGrid] Mesa ${table.number}: Backend dice 'disponible', todos los pedidos están 'paid' y no hay sesión abierta. Mostrando como disponible.`);
          return {
            status: 'available',
            label: 'Disponible',
            color: '#4caf50', // Verde
            icon: <CheckCircleIcon />,
            blinking: false,
            priority: 5
          };
        }
      }
    }

    // PRIORIDAD 6: Mesa libre/disponible (sin sesión abierta y sin pedidos)
    return {
      status: 'available',
      label: 'Disponible',
      color: '#4caf50', // Verde
      icon: <CheckCircleIcon />,
      blinking: false,
      priority: 5
    };
  };

  if (tables.length === 0) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          p: 4,
          textAlign: 'center',
          bgcolor: '#fafafa'
        }}
      >
        <TableRestaurantIcon sx={{ fontSize: 48, color: '#9e9e9e', mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          No hay mesas configuradas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configura tus mesas para comenzar a recibir pedidos
        </Typography>
      </Card>
    );
  }

  // Ordenar mesas numéricamente (1, 2, 3...) y NO por estado
  const sortedTables = [...tables].sort((a, b) => {
    // Intentar extraer número si es string "Mesa 1"
    const numA = Number(a.number) || Number(a.name?.replace(/\D/g, '')) || 0;
    const numB = Number(b.number) || Number(b.name?.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Estado de Mesas ({tables.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista en tiempo real del estado de todas las mesas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon />}
            label="Disponible"
            size="small"
            sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 600 }}
          />
          <Chip
            icon={<RestaurantIcon />}
            label="Ocupada"
            size="small"
            sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 600 }}
          />
          <Chip
            icon={<CleaningServicesIcon />}
            label="Por limpiar"
            size="small"
            sx={{ bgcolor: '#9c27b0', color: 'white', fontWeight: 600 }}
          />
          <Chip
            icon={<NotificationsActiveIcon />}
            label="Llamando"
            size="small"
            sx={{ bgcolor: '#ff1744', color: 'white', fontWeight: 600 }}
          />
        </Box>
      </Box>

      <Grid container spacing={2}>
        {sortedTables.map((table) => {
          const tableStatus = getTableStatus(table);

          const tableOrders = ordersByTable.get(table.number) || [];
          const activeOrdersCount = tableOrders.filter(o =>
            o.order_status !== 'paid'
          ).length;

          return (
            <Grid item xs={6} sm={4} md={3} lg={2.4} key={table.id || table.number}>
              <Card
                elevation={0}
                onClick={() => onTableClick && onTableClick(table)}
                sx={{
                  border: `2px solid ${tableStatus.color}`,
                  borderRadius: 2,
                  p: 2,
                  textAlign: 'center',
                  cursor: onTableClick ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  background: tableStatus.status === 'available'
                    ? 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)'
                    : `linear-gradient(135deg, ${tableStatus.color}15 0%, ${tableStatus.color}08 100%)`,
                  position: 'relative',
                  overflow: 'visible',
                  animation: tableStatus.blinking
                    ? 'pulse 1.5s ease-in-out infinite'
                    : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      boxShadow: `0 0 0 0 ${tableStatus.color}40`,
                      transform: 'scale(1)'
                    },
                    '50%': {
                      boxShadow: `0 0 0 8px ${tableStatus.color}00`,
                      transform: 'scale(1.02)'
                    }
                  },
                  '&:hover': onTableClick ? {
                    transform: 'translateY(-4px)',
                    boxShadow: `0px 8px 24px ${tableStatus.color}40`,
                    borderColor: tableStatus.color,
                    borderWidth: '3px'
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
                  <Badge
                    badgeContent={activeOrdersCount > 0 ? activeOrdersCount : null}
                    color="error"
                    overlap="circular"
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: `${tableStatus.color}20`,
                        color: tableStatus.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${tableStatus.color}40`
                      }}
                    >
                      {tableStatus.icon}
                    </Box>
                  </Badge>
                </Box>

                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 0.5,
                    color: tableStatus.status === 'calling' ? tableStatus.color : 'text.primary'
                  }}
                >
                  Mesa {table.number || table.name || '—'}
                </Typography>

                <Chip
                  icon={tableStatus.icon}
                  label={(() => {
                    return tableStatus.label;
                  })()}
                  size="small"
                  sx={{
                    bgcolor: tableStatus.color,
                    color: 'white',
                    fontWeight: 600,
                    mb: 1,
                    fontSize: '0.7rem',
                    height: '24px',
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />

                {tableStatus.status === 'occupied' && activeOrdersCount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {activeOrdersCount} pedido{activeOrdersCount > 1 ? 's' : ''} activo{activeOrdersCount > 1 ? 's' : ''}
                  </Typography>
                )}

                {tableStatus.status === 'calling' && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: tableStatus.color,
                      fontWeight: 600,
                      mt: 0.5
                    }}
                  >
                    ⚠️ Atención requerida
                  </Typography>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

