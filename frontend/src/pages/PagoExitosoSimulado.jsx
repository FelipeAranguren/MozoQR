import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { fetchModoPaymentStatus } from '../api/payments';

/**
 * Landing tras checkout MODO simulado (MODO_SIMULATE_ON_FAILURE).
 * Hace polling hasta que el backend marca APPROVED (~3s tras crear el checkout).
 */
export default function PagoExitosoSimulado() {
  const { slug } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const trx = search.get('trx') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trx || !slug) {
      setError('Enlace inválido.');
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      const maxAttempts = 45;
      for (let i = 0; i < maxAttempts; i += 1) {
        if (cancelled) return;
        try {
          const data = await fetchModoPaymentStatus(trx);
          const code = String(data?.status?.code || '').toUpperCase();
          if (code === 'APPROVED') {
            sessionStorage.removeItem('mozoqr_modo_pending');
            navigate(`/thank-you?type=modo&slug=${encodeURIComponent(slug)}`);
            return;
          }
        } catch {
          /* seguir */
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) {
        setError('No se pudo confirmar el pago. Volvé al menú e intentá de nuevo.');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [trx, slug, navigate]);

  return (
    <Box sx={{ p: 4, textAlign: 'center', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Confirmando pago (simulación)…</Typography>
        </>
      )}
    </Box>
  );
}
