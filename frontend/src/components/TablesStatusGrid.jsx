// frontend/src/components/TablesStatusGrid.jsx
import React from 'react';
import { Box, Typography, Card, Grid } from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';

/**
 * Componente para mostrar el estado de las mesas en tiempo real
 * Estados: disponible (verde), ocupada (azul), por limpiar (amarillo)
 */
export default function TablesStatusGrid({
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
   */
  const getTableStatus = (table) => {
    const tableOrders = ordersByTable.get(table.number) || [];
    const systemCalls = systemOrdersByTable.get(table.number) || [];
    const hasOpenSession = openSessions.some((s) => {
      const matches = Number(s.mesaNumber) === Number(table.number);
      if (matches) {
        console.log(`[TablesStatusGrid] Mesa ${table.number} tiene sesión abierta:`, s);
      }
      return matches;
    });
    const activeOrders = tableOrders.filter(o =>
      o.order_status === 'pending' ||
      o.order_status === 'preparing' ||
      o.order_status === 'served'
    );

    const hasSystemCall = systemCalls.length > 0;
    const hasPending = activeOrders.some(o => o.order_status === 'pending');
    const hasPreparing = activeOrders.some(o => o.order_status === 'preparing');
    const hasServed = activeOrders.some(o => o.order_status === 'served');
    const hasPaid = tableOrders.some(o => o.order_status === 'paid');

    // PRIORIDAD 1: Si hay llamada del sistema (mozo), mostrar como "llamando" con parpadeo
    if (hasSystemCall) {
      const callType = systemCalls[0];
      const isPayRequest = callType?.items?.some(item => {
        const prodName = (item?.product?.name || item?.name || '').toUpperCase();
        return prodName.includes('SOLICITUD DE COBRO') || prodName.includes('💳');
      }) || (callType?.customerNotes || '').toUpperCase().includes('SOLICITA COBRAR') || (callType?.customerNotes || '').toUpperCase().includes('CUENTA');
      return {
        status: 'calling',
        label: isPayRequest ? 'Solicita pago' : 'Llama mozo',
        color: '#1976d2', // Azul (mismo que ocupada)
        blinking: true,
        priority: 1
      };
    }

    // PRIORIDAD 2: Si tiene pedidos pendientes o en cocina, está ocupada
    if (hasPending || hasPreparing) {
      return {
        status: 'occupied',
        label: 'Ocupada',
        color: '#1976d2', // Azul
        blinking: false,
        priority: 2,
        activeOrdersCount: activeOrders.length
      };
    }

    // PRIORIDAD 2.5: Si tiene sesión abierta pero sin pedidos, está ocupada (cliente entró pero no pidió)
    if (hasOpenSession && activeOrders.length === 0 && !hasServed && !hasPaid) {
      return {
        status: 'occupied',
        label: 'Ocupada',
        color: '#1976d2', // Azul
        blinking: false,
        priority: 2,
        activeOrdersCount: 0
      };
    }

    // PRIORIDAD 3: Si tiene pedidos servidos pero no pagados, esperando cuenta
    if (hasServed && !hasPaid) {
      return {
        status: 'waiting-payment',
        label: 'Espera pago',
        color: '#ffc107', // Amarillo
        blinking: false,
        priority: 3
      };
    }

    // PRIORIDAD 4: Si tiene pedidos pagados recientemente, necesita limpieza
    // (asumimos que si la última sesión fue pagada hace menos de X minutos, necesita limpieza)
    if (hasPaid && !hasPending && !hasPreparing && !hasServed) {
      const paidOrders = tableOrders.filter(o => o.order_status === 'paid');
      const lastPaid = paidOrders.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      )[0];

      if (lastPaid) {
        const paidTime = new Date(lastPaid.updatedAt || lastPaid.createdAt);
        const minutesSincePaid = (Date.now() - paidTime.getTime()) / (1000 * 60);

        // Si fue pagado hace menos de 30 minutos, necesita limpieza
        if (minutesSincePaid < 30) {
          return {
            status: 'needs-cleaning',
            label: 'Por limpiar',
            color: '#ffc107', // Amarillo
            blinking: false,
            priority: 4
          };
        }
      }
    }

    // PRIORIDAD 5: Mesa libre/disponible
    return {
      status: 'available',
      label: 'Disponible',
      color: '#4caf50', // Verde
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

  // Ordenar mesas numéricamente (de menor a mayor)
  const sortedTables = [...tables].sort((a, b) => {
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
      </Box>

      <Grid container spacing={1}>
        {sortedTables.map((table) => {
          const tableStatus = getTableStatus(table);

          return (
            <Grid item xs={2.4} sm={2} md={1.5} lg={1.2} key={table.id || table.number}>
              <Card
                elevation={0}
                onClick={() => onTableClick && onTableClick(table)}
                sx={{
                  border: `2px solid ${tableStatus.color}`,
                  borderRadius: 1,
                  p: 0.75,
                  minHeight: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: onTableClick ? 'pointer' : 'default',
                  transition: 'box-shadow 0.2s ease',
                  background: 'transparent',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': onTableClick ? {
                    boxShadow: `0px 2px 8px ${tableStatus.color}40`,
                    zIndex: 1,
                  } : {}
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: tableStatus.color,
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                >
                  {table.number || table.name || '—'}
                </Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

