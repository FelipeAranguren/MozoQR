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
import { COLORS } from '../theme';

/**
 * Indica si un pedido del sistema es "solicitud de cobro" (pago efectivo/tarjeta en mesa).
 * Misma lógica que getTableStatus para request-payment.
 */
export function isPayRequestOrder(order) {
  if (!order) return false;
  const items = order?.items || [];
  const hasPayItem = items.some((item) => {
    const prodName = (item?.product?.name || item?.name || item?.notes || '').toUpperCase();
    return prodName.includes('SOLICITUD DE COBRO') || prodName.includes('💳');
  });
  if (hasPayItem) return true;
  const notes = (order?.customerNotes || '').toUpperCase();
  return notes.includes('SOLICITA COBRAR') || notes.includes('CUENTA');
}

/**
 * Dado un array de pedidos del sistema, devuelve los números de mesa que tienen solicitud de cobro activa.
 * Usado por el banner de alerta global.
 */
export function getTablesRequestingPayment(systemOrders) {
  if (!Array.isArray(systemOrders)) return [];
  const tableNumbers = new Set();
  systemOrders.forEach((order) => {
    if (!isPayRequestOrder(order)) return;
    const raw = order?.mesa_sesion?.mesa?.number ?? order?.mesa ?? order?.tableNumber ?? null;
    if (raw == null) return;
    const tableNum = Number(raw);
    if (!Number.isNaN(tableNum)) tableNumbers.add(tableNum);
  });
  return Array.from(tableNumbers);
}

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
  // Agrupar pedidos por mesa (clave siempre numérica para que coincida con table.number)
  const ordersByTable = React.useMemo(() => {
    try {
      const map = new Map();
      if (Array.isArray(orders)) {
        orders.forEach(order => {
          const raw = order?.mesa_sesion?.mesa?.number ?? order?.mesa ?? order?.tableNumber ?? null;
          if (raw == null) return;
          const tableNum = Number(raw);
          if (Number.isNaN(tableNum)) return;
          if (!map.has(tableNum)) map.set(tableNum, []);
          map.get(tableNum).push(order);
        });
      }
      return map;
    } catch (error) {
      console.error('Error grouping orders by table:', error);
      return new Map();
    }
  }, [orders]);

  // Agrupar pedidos del sistema por mesa (clave numérica)
  const systemOrdersByTable = React.useMemo(() => {
    try {
      const map = new Map();
      if (Array.isArray(systemOrders)) {
        systemOrders.forEach(order => {
          const raw = order?.mesa_sesion?.mesa?.number ?? order?.mesa ?? order?.tableNumber ?? null;
          if (raw == null) return;
          const tableNum = Number(raw);
          if (Number.isNaN(tableNum)) return;
          if (!map.has(tableNum)) map.set(tableNum, []);
          map.get(tableNum).push(order);
        });
      }
      return map;
    } catch (error) {
      return new Map();
    }
  }, [systemOrders]);

  const getHoverBorderColor = (status) => {
    switch (status) {
      case 'available':
        return '#15803d';
      case 'occupied':
        return '#1e40af';
      case 'needs-cleaning':
        return COLORS.warning;
      default:
        return COLORS.textSecondary;
    }
  };

  /**
   * Determina el estado completo de una mesa
   * REGLAS CRÍTICAS:
   * 1. Si hay sesión abierta → Mesa OCUPADA (cliente sentado)
   * 2. Si hay pedidos sin pagar (pending, preparing, served) → Mesa OCUPADA
   * 3. Solo si no hay sesión ni pedidos sin pagar → respetar estado del backend
   */
  const getTableStatus = (table) => {
    const tableKey = Number(table.number);
    const tableOrders = ordersByTable.get(tableKey) || [];
    const systemCalls = systemOrdersByTable.get(tableKey) || [];
    const hasOpenSession = openSessions.some((s) => {
      const matches = Number(s.mesaNumber) === Number(table.number);
      return matches;
    });

    const unpaidOrders = tableOrders.filter(o => o.order_status !== 'paid' && o.order_status !== 'cancelled');

    const hasSystemCall = systemCalls.length > 0;
    const hasServed = unpaidOrders.some(o => o.order_status === 'served');
    const hasPaid = tableOrders.some(o => o.order_status === 'paid');
    
    if (table.status === 'por_limpiar') {
      return {
        status: 'needs-cleaning',
        label: 'Por limpiar',
        color: COLORS.warning,
        icon: <CleaningServicesIcon />,
        blinking: false,
        priority: 2
      };
    }

    if (hasSystemCall) {
      const callType = systemCalls[0];
      const isPayRequest = callType?.items?.some(item => {
        const prodName = (item?.product?.name || item?.name || item?.notes || '').toUpperCase();
        return prodName.includes('SOLICITUD DE COBRO') || prodName.includes('💳');
      }) || (callType?.customerNotes || '').toUpperCase().includes('SOLICITA COBRAR') || (callType?.customerNotes || '').toUpperCase().includes('CUENTA');

      if (isPayRequest) {
        return {
          status: 'request-payment',
          label: 'Solicita pago',
          color: '#7c3aed',
          icon: <AccountBalanceWalletIcon />,
          blinking: true,
          priority: 1
        };
      }

      return {
        status: 'calling',
        label: 'Llama mozo',
        color: COLORS.error,
        icon: <NotificationsActiveIcon />,
        blinking: true,
        priority: 1
      };
    }
    
    if (unpaidOrders.length > 0) {
      return {
        status: 'occupied',
        label: hasServed && !hasPaid ? 'Espera pago' : 'Ocupada',
        color: '#2563eb',
        icon: hasServed && !hasPaid ? <AccessTimeIcon /> : <RestaurantIcon />,
        blinking: false,
        priority: 1,
        activeOrdersCount: unpaidOrders.length
      };
    }
    
    if (table.status) {
      if (table.status === 'ocupada') {
        return {
          status: 'occupied',
          label: 'Ocupada',
          color: '#2563eb',
          icon: <RestaurantIcon />,
          blinking: false,
          priority: 3,
          activeOrdersCount: unpaidOrders.length
        };
      }
      
      if (table.status === 'disponible') {
        const allOrdersPaid = tableOrders.length === 0 || tableOrders.every(o => o.order_status === 'paid');
        
        if (allOrdersPaid) {
          return {
            status: 'available',
            label: 'Disponible',
            color: COLORS.success,
            icon: <CheckCircleIcon />,
            blinking: false,
            priority: 5
          };
        }
      }
    }

    return {
      status: 'available',
      label: 'Disponible',
      color: COLORS.success,
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
          border: `1px solid ${COLORS.border}`,
          p: 4,
          textAlign: 'center',
          bgcolor: 'background.default'
        }}
      >
        <TableRestaurantIcon sx={{ fontSize: 48, color: COLORS.textMuted, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          No hay mesas configuradas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configura tus mesas para comenzar a recibir pedidos
        </Typography>
      </Card>
    );
  }

  const sortedTables = [...tables].sort((a, b) => {
    const numA = Number(a.number) || Number(a.name?.replace(/\D/g, '')) || 0;
    const numB = Number(b.number) || Number(b.name?.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return (
    <Box
      sx={{
        overflowX: 'hidden',
        width: '100%',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Mesas ({tables.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {[
            { icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, label: 'Disponible', color: COLORS.success },
            { icon: <RestaurantIcon sx={{ fontSize: 14 }} />, label: 'Ocupada', color: '#2563eb' },
            { icon: <CleaningServicesIcon sx={{ fontSize: 14 }} />, label: 'Limpiar', color: COLORS.warning },
            { icon: <NotificationsActiveIcon sx={{ fontSize: 14 }} />, label: 'Llamando', color: COLORS.error },
            { icon: <AccountBalanceWalletIcon sx={{ fontSize: 14 }} />, label: 'Pago', color: '#7c3aed' },
          ].map((s) => (
            <Chip
              key={s.label}
              icon={s.icon}
              label={s.label}
              size="small"
              sx={{ bgcolor: s.color, color: 'white', fontWeight: 600, fontSize: '0.675rem', height: 20, '& .MuiChip-label': { px: 0.5 }, '& .MuiChip-icon': { ml: 0.25 } }}
            />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Grid
          container
          spacing={1}
          sx={{
            width: '100%',
            margin: 0,
          }}
        >
        {sortedTables.map((table) => {
          const tableStatus = getTableStatus(table);

          const tableOrders = ordersByTable.get(table.number) || [];
          const activeOrdersCount = tableOrders.filter(o =>
            o.order_status !== 'paid' && o.order_status !== 'cancelled'
          ).length;

          return (
            <Grid item xs={4} sm={3} md={2} lg={1.5} key={table.id || table.number}>
              <Card
                elevation={0}
                onClick={() => onTableClick && onTableClick(table)}
                title=""
                sx={{
                  border: `1px solid ${tableStatus.color}`,
                  borderRadius: 2,
                  p: { xs: 0.75, sm: 1 },
                  textAlign: 'center',
                  cursor: onTableClick ? 'pointer' : 'default',
                  transition: 'box-shadow 0.2s ease',
                  background: tableStatus.status === 'available'
                    ? COLORS.white
                    : `linear-gradient(135deg, ${COLORS.white} 0%, ${tableStatus.color}10 100%)`,
                  position: 'relative',
                  overflow: 'hidden',
                  animation: tableStatus.blinking
                    ? 'pulse 1.5s ease-in-out infinite'
                    : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      boxShadow: `0 0 0 0 ${tableStatus.color}40`,
                      transform: 'scale(1)'
                    },
                    '50%': {
                      boxShadow: `0 0 0 6px ${tableStatus.color}00`,
                      transform: 'scale(1.01)'
                    }
                  },
                  '&:hover': onTableClick ? {
                    boxShadow: `0 4px 16px ${tableStatus.color}24`,
                    borderColor: getHoverBorderColor(tableStatus.status),
                    borderWidth: '1px',
                    zIndex: 1,
                    '& .MuiChip-root': {
                      bgcolor: getHoverBorderColor(tableStatus.status),
                      transition: 'none',
                    },
                    '& .table-icon-box': {
                      bgcolor: `${getHoverBorderColor(tableStatus.status)}20`,
                      color: getHoverBorderColor(tableStatus.status),
                      border: `1px solid ${getHoverBorderColor(tableStatus.status)}40`,
                      transition: 'none',
                    },
                    '& .table-status-text': {
                      color: getHoverBorderColor(tableStatus.status),
                      transition: 'none',
                    }
                  } : {}
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 0.5,
                  }}
                >
                  <Badge
                    badgeContent={activeOrdersCount > 0 ? activeOrdersCount : null}
                    color="error"
                    overlap="circular"
                    slotProps={{
                      badge: {
                        title: '',
                        'aria-label': '',
                      }
                    }}
                    sx={{
                      '& .MuiBadge-badge': {
                        pointerEvents: 'none',
                        fontSize: '0.65rem',
                        minWidth: 16,
                        height: 16,
                      }
                    }}
                  >
                    <Box
                      className="table-icon-box"
                      sx={{
                        p: 0.75,
                        borderRadius: 1.5,
                        bgcolor: `${tableStatus.color}20`,
                        color: tableStatus.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${tableStatus.color}40`,
                        transition: 'none',
                        '& .MuiSvgIcon-root': { fontSize: 18 },
                      }}
                    >
                      {tableStatus.icon}
                    </Box>
                  </Badge>
                </Box>

                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    lineHeight: 1.2,
                    mb: 0.25,
                    color: tableStatus.status === 'calling' ? tableStatus.color : 'text.primary'
                  }}
                >
                  {table.number || table.name || '—'}
                </Typography>

                <Chip
                  label={tableStatus.label}
                  size="small"
                  sx={{
                    bgcolor: tableStatus.color,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.6rem',
                    height: 18,
                    transition: 'none',
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />

                {tableStatus.status === 'occupied' && activeOrdersCount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
                    {activeOrdersCount} pedido{activeOrdersCount > 1 ? 's' : ''}
                  </Typography>
                )}

                {tableStatus.status === 'calling' && (
                  <Typography
                    className="table-status-text"
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: tableStatus.color,
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      mt: 0.25,
                      transition: 'none',
                    }}
                  >
                    ⚠️ Atención
                  </Typography>
                )}
              </Card>
            </Grid>
          );
        })}
        </Grid>
      </Box>
    </Box>
  );
}
