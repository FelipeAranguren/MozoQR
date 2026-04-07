import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { confirmSimulatedModo } from '../api/payments';

const moneyArs = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n) || 0);

/**
 * Checkout simulado cuando MODO no responde (MODO_SIMULATE_ON_FAILURE).
 * El usuario confirma aquí; el backend aplica la misma lógica que el webhook (paid, mozo, mesa).
 */
export default function PagoSimulado() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const trx = search.get('trx') || '';
  const slug = search.get('slug') || '';
  const monto = useMemo(() => {
    const raw = search.get('monto');
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : 0;
  }, [search]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const invalid = !trx || !trx.startsWith('mzqr-sim-');

  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await confirmSimulatedModo(trx);
      if (!data?.ok) {
        throw new Error(data?.error || 'No se pudo confirmar el pago.');
      }
      sessionStorage.removeItem('mozoqr_modo_pending');
      const q = slug ? `&slug=${encodeURIComponent(slug)}` : '';
      navigate(`/thank-you?type=modo${q}`);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (typeof e?.message === 'string' ? e.message : 'Error al confirmar. Intentá de nuevo.');
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (invalid) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f4f4f5',
          p: 2,
        }}
      >
        <Paper elevation={3} sx={{ p: 4, maxWidth: 400, textAlign: 'center' }}>
          <Typography color="error">Enlace de pago inválido o incompleto.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #1a0a14 0%, #2d1535 40%, #4a1942 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 420,
          width: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#fff',
        }}
      >
        <Box
          sx={{
            background: 'linear-gradient(90deg, #e91e8c 0%, #9c27b0 100%)',
            color: '#fff',
            py: 2.5,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.95 }}>
            MODO · Simulación
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
            Pagar con MODO
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            Entorno de prueba — no se debita dinero real
          </Typography>
        </Box>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Total a pagar
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 3 }}>
            {moneyArs(monto)}
          </Typography>
          {error ? (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
          ) : null}
          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={loading}
            onClick={() => void handleConfirm()}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #e91e8c 0%, #9c27b0 100%)',
              boxShadow: 2,
              '&:hover': {
                background: 'linear-gradient(90deg, #d81b7a 0%, #8e24aa 100%)',
              },
            }}
          >
            {loading ? <CircularProgress size={26} color="inherit" /> : 'Confirmar pago'}
          </Button>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
            Al confirmar, el restaurante recibirá el aviso como si hubiera llegado el webhook de MODO.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
