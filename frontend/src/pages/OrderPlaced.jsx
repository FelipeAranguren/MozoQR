import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Paper, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { motion } from 'framer-motion';
import { fetchOrderDetails } from '../api/tenant';
import useTableSession from '../hooks/useTableSession';
import {
  confirmationHeadlineForStatus,
  confirmationSubtitleForStatus,
} from '../utils/orderStatusEs';

const POLL_MS = 4000;

export default function OrderPlaced() {
  const { slug, orderId } = useParams();
  const navigate = useNavigate();
  const { table, tableSessionId } = useTableSession();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !table || orderId == null || orderId === '') {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const orders = await fetchOrderDetails(slug, { table, tableSessionId });
        if (cancelled) return;
        const match = orders.find((o) => String(o.id) === String(orderId));
        if (match) setStatus(match.order_status);
      } catch (e) {
        console.warn('OrderPlaced poll:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, table, tableSessionId, orderId]);

  const goMenu = () => {
    const q = table != null && !Number.isNaN(table) ? `?t=${encodeURIComponent(table)}` : '';
    navigate(`/${slug}/menu${q}`);
  };

  if (!table || Number.isNaN(table)) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
        <Paper sx={{ p: 4, width: 1, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>
            Falta el número de mesa
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Volvé al menú escaneando el QR o indicando tu mesa.
          </Typography>
          <Button variant="contained" onClick={() => navigate(`/${slug}/menu`)} sx={{ textTransform: 'none' }}>
            Ir al menú
          </Button>
        </Paper>
      </Container>
    );
  }

  const effectiveStatus = status || 'pending';
  const headline = confirmationHeadlineForStatus(effectiveStatus);
  const subtitle = confirmationSubtitleForStatus(effectiveStatus);

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Paper
        elevation={3}
        component={motion.div}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        sx={{
          p: { xs: 3, sm: 4 },
          width: 1,
          textAlign: 'center',
          borderRadius: 4,
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'linear-gradient(160deg, #ffffff 0%, #f0fdfa 100%)'
              : 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
          {loading && status == null ? (
            <CircularProgress size={56} sx={{ color: 'primary.main' }} />
          ) : (
            <CheckCircleOutlineIcon sx={{ fontSize: 72, color: 'primary.main' }} />
          )}
        </Box>

        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          {headline}
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
          {subtitle}
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<RestaurantMenuIcon />}
          onClick={goMenu}
          sx={{ textTransform: 'none', borderRadius: 2, py: 1.25, fontWeight: 700 }}
        >
          Volver al menú
        </Button>
      </Paper>
    </Container>
  );
}
