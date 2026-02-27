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

  /**
   * Obtiene el color oscuro para el hover según el estado de la mesa
   */
  const getHoverBorderColor = (status) => {
    switch (status) {
      case 'available':
        return '#2e7d32'; // Verde más oscuro
      case 'occupied':
        return '#0d47a1'; // Azul mucho más oscuro para contraste más notorio
      case 'needs-cleaning':
        return '#f57c00'; // Amarillo más oscuro
      default:
        return '#424242'; // Gris oscuro por defecto
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

    // Pedidos sin pagar (cualquier estado que no sea 'paid' ni 'cancelled')
    // CRÍTICO: Los pedidos cancelados NO deben contarse como activos
    const unpaidOrders = tableOrders.filter(o => o.order_status !== 'paid' && o.order_status !== 'cancelled');

    const hasSystemCall = systemCalls.length > 0;
    const hasServed = unpaidOrders.some(o => o.order_status === 'served');
    const hasPaid = tableOrders.some(o => o.order_status === 'paid');
    
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

    // PRIORIDAD 1: Si hay llamada del sistema (mozo) - MÁXIMA PRIORIDAD VISUAL
    // Esto debe mostrarse incluso si la mesa está ocupada
    if (hasSystemCall) {
      const callType = systemCalls[0];
      const isPayRequest = callType?.items?.some(item => {
        // El nombre del producto del sistema puede estar en:
        // 1. item.product.name (producto real)
        // 2. item.name (campo directo)
        // 3. item.notes (para productos del sistema, el nombre se guarda en notes)
        const prodName = (item?.product?.name || item?.name || item?.notes || '').toUpperCase();
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
    
    // REGLA CRÍTICA #1: Si hay pedidos sin pagar, la mesa SIEMPRE está ocupada
    if (unpaidOrders.length > 0) {
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
    
    // REGLA CRÍTICA #2: Si NO hay pedidos sin pagar, la mesa está DISPONIBLE
    // CRÍTICO: NO usar openSessions para determinar ocupación después de pagar
    // Si activeOrders viene vacío (porque fetchActiveOrders solo trae pedidos no pagados),
    // entonces la mesa está disponible, independientemente de si hay sesión abierta o no
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
        // Solo mostrar como disponible si NO hay pedidos sin pagar
        // CRÍTICO: No verificar hasOpenSession porque las sesiones pueden quedar abiertas después de pagar
        // La única fuente de verdad es si hay pedidos sin pagar o no
        const allOrdersPaid = tableOrders.length === 0 || tableOrders.every(o => o.order_status === 'paid');
        
        if (allOrdersPaid) {
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

    // PRIORIDAD 6: Mesa libre/disponible (sin pedidos sin pagar)
    // CRÍTICO: Si llegamos aquí, significa que no hay pedidos sin pagar
    // Por lo tanto, la mesa está disponible, independientemente de sesiones abiertas
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
    <Box
      sx={{
        // Asegurar que no aparezcan scrollbars que causen desplazamiento
        overflowX: 'hidden',
        width: '100%',
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Estado de Mesas ({tables.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista en tiempo real del estado de todas las mesas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
            label="Disponible"
            size="small"
            sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, '& .MuiChip-label': { px: 0.75 } }}
          />
          <Chip
            icon={<RestaurantIcon sx={{ fontSize: 18 }} />}
            label="Ocupada"
            size="small"
            sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, '& .MuiChip-label': { px: 0.75 } }}
          />
          <Chip
            icon={<CleaningServicesIcon sx={{ fontSize: 18 }} />}
            label="Por limpiar"
            size="small"
            sx={{ bgcolor: '#9c27b0', color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, '& .MuiChip-label': { px: 0.75 } }}
          />
          <Chip
            icon={<NotificationsActiveIcon sx={{ fontSize: 18 }} />}
            label="Llamando"
            size="small"
            sx={{ bgcolor: '#ff1744', color: 'white', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, '& .MuiChip-label': { px: 0.75 } }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          // Contenedor para evitar scrollbars horizontales
          overflowX: 'hidden',
          width: '100%',
          // Prevenir que aparezcan scrollbars verticales que causen desplazamiento
          overflowY: 'visible',
          // Asegurar que el contenido no cause scrollbars
          maxWidth: '100%',
        }}
      >
        <Grid 
          container 
          spacing={2}
          sx={{
            // Asegurar que el grid no cause scrollbars
            width: '100%',
            margin: 0,
          }}
        >
        {sortedTables.map((table) => {
          const tableStatus = getTableStatus(table);

          const tableOrders = ordersByTable.get(table.number) || [];
          // CRÍTICO: Excluir pedidos cancelados del contador - no deben aparecer en la burbuja roja
          const activeOrdersCount = tableOrders.filter(o =>
            o.order_status !== 'paid' && o.order_status !== 'cancelled'
          ).length;

          return (
            <Grid item xs={6} sm={4} md={3} lg={2.4} key={table.id || table.number}>
              <Card
                elevation={0}
                onClick={() => onTableClick && onTableClick(table)}
                title=""
                sx={{
                  border: `2px solid ${tableStatus.color}`,
                  borderRadius: 2,
                  p: { xs: 1.25, sm: 1.5, md: 2 },
                  textAlign: 'center',
                  cursor: onTableClick ? 'pointer' : 'default',
                  // Transición solo para box-shadow, todos los colores cambian instantáneamente
                  transition: 'box-shadow 0.2s ease',
                  // border-color, bgcolor, color sin transición para cambio instantáneo y simultáneo
                  // Mantener borderWidth constante para no cambiar el tamaño
                  background: tableStatus.status === 'available'
                    ? 'linear-gradient(135deg, #ffffff 0%, #f1f8e9 100%)'
                    : `linear-gradient(135deg, ${tableStatus.color}15 0%, ${tableStatus.color}08 100%)`,
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
                      boxShadow: `0 0 0 8px ${tableStatus.color}00`,
                      transform: 'scale(1.02)'
                    }
                  },
                  '&:hover': onTableClick ? {
                    // SOLO efectos visuales que NO cambian el tamaño ni causan scrollbars
                    boxShadow: `0px 2px 8px ${tableStatus.color}40`,
                    // Cambiar a color oscuro según el estado (instantáneo, sin transición)
                    borderColor: getHoverBorderColor(tableStatus.status),
                    // Mantener borderWidth en 2px para no cambiar el tamaño del casillero
                    borderWidth: '2px',
                    // NO usar transform, scale, ni translateY - mantiene el tamaño exacto
                    // border-color cambia instantáneamente (sin transición)
                    zIndex: 1,
                    // Cambiar color del Chip a color oscuro (sin transición)
                    '& .MuiChip-root': {
                      bgcolor: getHoverBorderColor(tableStatus.status),
                      transition: 'none', // Sin transición para cambio instantáneo
                    },
                    // Cambiar color del Box del icono a color oscuro (sin transición)
                    '& .table-icon-box': {
                      bgcolor: `${getHoverBorderColor(tableStatus.status)}20`,
                      color: getHoverBorderColor(tableStatus.status),
                      border: `2px solid ${getHoverBorderColor(tableStatus.status)}40`,
                      transition: 'none', // Sin transición para cambio instantáneo
                    },
                    // Cambiar color del Typography de estado (solo para 'calling', sin transición)
                    '& .table-status-text': {
                      color: getHoverBorderColor(tableStatus.status),
                      transition: 'none', // Sin transición para cambio instantáneo
                    }
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
                    // Deshabilitar cualquier tooltip automático
                    slotProps={{
                      badge: {
                        // Deshabilitar tooltip
                        title: '',
                        'aria-label': '',
                      }
                    }}
                    sx={{
                      // Asegurar que no aparezcan tooltips
                      '& .MuiBadge-badge': {
                        pointerEvents: 'none',
                      }
                    }}
                  >
                    <Box
                      className="table-icon-box"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: `${tableStatus.color}20`,
                        color: tableStatus.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${tableStatus.color}40`,
                        // Sin transición para cambio instantáneo de colores
                        transition: 'none',
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
                    // Sin transición para cambio instantáneo de color
                    transition: 'none',
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
                    className="table-status-text"
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: tableStatus.color,
                      fontWeight: 600,
                      mt: 0.5,
                      // Sin transición para cambio instantáneo de color
                      transition: 'none',
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
    </Box>
  );
}

