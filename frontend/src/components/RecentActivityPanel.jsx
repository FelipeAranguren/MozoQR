// frontend/src/components/RecentActivityPanel.jsx
import React, { useState } from 'react';
import { Box, Typography, Card, List, ListItem, ListItemText, Chip, Avatar, Button } from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { MARANA_COLORS } from '../theme';

/**
 * Panel de Actividad Reciente - Muestra últimos pedidos y cuentas pagadas
 */
export default function RecentActivityPanel({ recentOrders = [], recentInvoices = [] }) {
  const [expanded, setExpanded] = useState(false);
  const money = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
      .format(Number(n) || 0);

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return MARANA_COLORS.primary;
      case 'served': return MARANA_COLORS.secondary;
      case 'preparing': return MARANA_COLORS.accent;
      case 'pending': return MARANA_COLORS.textSecondary;
      default: return MARANA_COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      paid: 'Pagado',
      served: 'Servido',
      preparing: 'Preparando',
      pending: 'Pendiente'
    };
    return labels[status] || status;
  };

  // Combinar y ordenar actividades recientes
  const allActivities = React.useMemo(() => {
    const all = [
      ...recentOrders.map(order => ({
        type: 'order',
        id: order.id,
        title: `Pedido #${order.id}`,
        subtitle: `Mesa ${order.mesa || '—'}`,
        amount: order.total,
        status: order.order_status,
        time: order.createdAt || order.updatedAt,
        icon: <ShoppingCartIcon />
      })),
      ...recentInvoices.map(invoice => ({
        type: 'invoice',
        id: invoice.invoiceId || invoice.id,
        title: `Factura ${String(invoice.invoiceId || invoice.id).slice(-8)}`,
        subtitle: `Mesa ${invoice.table || '—'}`,
        amount: invoice.total,
        status: 'paid',
        time: invoice.closedAt || invoice.updatedAt,
        icon: <ReceiptIcon />
      }))
    ];

    return all.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [recentOrders, recentInvoices]);

  // Mostrar 5 inicialmente, todas si está expandido
  const INITIAL_LIMIT = 5;
  const activities = expanded ? allActivities : allActivities.slice(0, INITIAL_LIMIT);
  const hasMore = allActivities.length > INITIAL_LIMIT;

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
            Actividad Reciente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Últimos pedidos y cuentas pagadas
          </Typography>
        </Box>
      </Box>

      {allActivities.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <AccessTimeIcon sx={{ fontSize: 48, color: MARANA_COLORS.textSecondary, mb: 2, opacity: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            No hay actividad reciente
          </Typography>
        </Box>
      ) : (
        <>
          <List sx={{ p: 0 }}>
            {activities.map((activity, idx) => (
              <ListItem
                key={`${activity.type}-${activity.id}-${idx}`}
                sx={{
                  borderBottom: idx < activities.length - 1 || (hasMore && !expanded) ? `1px solid ${MARANA_COLORS.border}40` : 'none',
                  py: 2,
                  px: 0,
                  '&:hover': {
                    bgcolor: `${MARANA_COLORS.background}80`,
                    borderRadius: 2
                  }
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: `${getStatusColor(activity.status)}15`,
                    color: getStatusColor(activity.status),
                    width: 40,
                    height: 40,
                    mr: 2
                  }}
                >
                  {activity.icon}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {activity.title}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: MARANA_COLORS.primary }}>
                        {money(activity.amount)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {activity.subtitle}
                      </Typography>
                      <Chip
                        label={getStatusLabel(activity.status)}
                        size="small"
                        sx={{
                          bgcolor: `${getStatusColor(activity.status)}15`,
                          color: getStatusColor(activity.status),
                          height: 20,
                          fontSize: '10px',
                          fontWeight: 600
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {formatTime(activity.time)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pt: 2, borderTop: `1px solid ${MARANA_COLORS.border}40` }}>
              <Button
                onClick={() => setExpanded(!expanded)}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{
                  textTransform: 'none',
                  color: MARANA_COLORS.primary,
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: `${MARANA_COLORS.primary}10`
                  }
                }}
              >
                {expanded ? 'Mostrar menos' : 'Mostrar más'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Card>
  );
}
