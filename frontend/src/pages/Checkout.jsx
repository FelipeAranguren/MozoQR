// frontend/src/pages/Checkout.jsx
import React, { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  useTheme,
  useMediaQuery,
  CircularProgress,
  alpha,
} from '@mui/material';
import { COLORS } from '../theme';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { formatArs } from '../api/exchangeRate';
import { PLAN_BASE_USD } from '../constants/planPricing';
import { createSubscriptionPreference } from '../api/payments';

/** Ícono/logo Mercado Pago (SVG inline para que siempre cargue, sin depender de URLs externas) */
const MP_BLUE = '#009EE3';
function MercadoPagoLogo() {
  return (
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 28"
      sx={{ height: 28, width: 40, flexShrink: 0 }}
      aria-hidden
    >
      <rect x="0" y="4" width="36" height="20" rx="3" ry="3" fill={MP_BLUE} opacity="0.15" stroke={MP_BLUE} strokeWidth="1.5" />
      <rect x="4" y="8" width="28" height="4" rx="1" fill={MP_BLUE} opacity="0.4" />
      <circle cx="8" cy="18" r="2" fill={MP_BLUE} />
      <circle cx="14" cy="18" r="2" fill={MP_BLUE} opacity="0.6" />
    </Box>
  );
}

const PLAN_OPTIONS = [
  { key: 'basic', planKey: 'BASIC', name: 'Básico', priceUsd: 0.0007, color: COLORS.textSecondary },
  { key: 'pro', planKey: 'PRO', name: 'Pro', priceUsd: PLAN_BASE_USD.PRO, color: COLORS.secondary },
  { key: 'ultra', planKey: 'ULTRA', name: 'Ultra', priceUsd: PLAN_BASE_USD.ULTRA, color: COLORS.primary },
];

const VALID_PLAN_KEYS = PLAN_OPTIONS.map((p) => p.key);

function getDefaultPlan(searchPlan) {
  const p = (searchPlan || '').toLowerCase();
  return VALID_PLAN_KEYS.includes(p) ? p : 'basic';
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const urlPlan = searchParams.get('plan');
  const defaultPlan = useMemo(() => getDefaultPlan(urlPlan), [urlPlan]);

  const [selectedPlan, setSelectedPlan] = React.useState(defaultPlan);
  const [paymentMethod, setPaymentMethod] = React.useState('mercadopago');

  useEffect(() => {
    setSelectedPlan(getDefaultPlan(urlPlan));
  }, [urlPlan]);

  const { rate, loading } = useExchangeRate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState(null);

  const planOption = PLAN_OPTIONS.find((p) => p.key === selectedPlan) || PLAN_OPTIONS[0];
  const totalArs = planOption.priceUsd * rate;

  const handleFinalizarCompra = async () => {
    if (paymentMethod !== 'mercadopago') {
      setSubmitError('Por ahora solo está disponible el pago con Mercado Pago.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await createSubscriptionPreference({ plan: selectedPlan });
      const url = result?.init_point;
      if (url) {
        window.location.href = url;
        return;
      }
      setSubmitError('No se recibió el link de pago. Intentá de nuevo.');
    } catch (err) {
      setSubmitError(err?.message || 'Error al generar el link de pago. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: COLORS.bg,
        py: { xs: 3, md: 5 },
        px: 1,
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Box
          sx={{
            p: { xs: 3, sm: 4 },
            mb: 3,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadow1,
          }}
        >
          <Typography
            variant="overline"
            component="p"
            sx={{ mb: 1, color: COLORS.textSecondary }}
          >
            Suscripción
          </Typography>
          <Typography variant="h2" align="center" gutterBottom sx={{ color: COLORS.text }}>
            Completar tu suscripción
          </Typography>
          <Typography variant="body1" align="center" sx={{ color: COLORS.textSecondary }}>
            Elige tu plan y método de pago con una interfaz más limpia, confiable y clara.
          </Typography>
        </Box>

        {/* Selector de plan */}
        <Card sx={{ mb: 3, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: COLORS.text }}>
              Plan
            </Typography>
            <Tabs
              value={selectedPlan}
              onChange={(_, v) => setSelectedPlan(v)}
              variant={isMobile ? 'fullWidth' : 'standard'}
              sx={{
                minHeight: 48,
                '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' },
                '& .Mui-selected': { color: COLORS.primary },
                '& .MuiTabs-indicator': { bgcolor: COLORS.primary, height: 3 },
              }}
            >
              {PLAN_OPTIONS.map((opt) => (
                <Tab
                  key={opt.key}
                  value={opt.key}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <span>{opt.name}</span>
                      {loading ? (
                        <CircularProgress size={16} sx={{ color: COLORS.textMuted }} />
                      ) : (
                        <Typography component="span" variant="caption" sx={{ color: COLORS.textSecondary, fontWeight: 500 }}>
                          $ {formatArs(opt.priceUsd * rate)} ARS
                        </Typography>
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Método de pago */}
        <Card sx={{ mb: 3, borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: COLORS.text }}>
              Selecciona tu método de pago
            </Typography>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                sx={{ gap: 0 }}
              >
                <Card
                  component="label"
                  variant="outlined"
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: `2px solid ${paymentMethod === 'mercadopago' ? COLORS.primary : COLORS.border}`,
                    borderRadius: '8px',
                    bgcolor: paymentMethod === 'mercadopago' ? alpha(COLORS.primary, 0.03) : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: alpha(COLORS.primary, 0.5) },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      value="mercadopago"
                      control={<Radio sx={{ color: COLORS.primary, '&.Mui-checked': { color: COLORS.primary } }} />}
                      label=""
                      sx={{ m: 0 }}
                    />
                    <MercadoPagoLogo />
                    <Box>
                      <Typography fontWeight="600" sx={{ color: COLORS.text }}>
                        Mercado Pago
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                        El pago se realizará en pesos argentinos (ARS)
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>

        {/* Resumen de compra */}
        <Card
          sx={{
            mb: 3,
            borderRadius: '12px',
            border: `1px solid ${COLORS.border}`,
            bgcolor: alpha(COLORS.secondary, 0.04),
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: COLORS.text }}>
              Resumen de compra
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: COLORS.textSecondary }}>Plan seleccionado</Typography>
                <Typography fontWeight="600" sx={{ color: COLORS.secondary }}>
                  {planOption.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: COLORS.textSecondary }}>Precio en USD</Typography>
                <Typography fontWeight="600" sx={{ color: COLORS.text }}>USD {planOption.priceUsd}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: COLORS.textSecondary }}>Valor del dólar actual</Typography>
                <Typography fontWeight="600" sx={{ color: COLORS.text }}>$ {formatArs(rate)} ARS</Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                  pt: 2,
                  borderTop: `1px solid ${COLORS.border}`,
                }}
              >
                <Typography variant="h6" fontWeight="700" sx={{ color: COLORS.text }}>
                  Total
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: COLORS.text }}>
                  $ {formatArs(totalArs)} ARS
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {submitError && (
          <Typography color="error" sx={{ mb: 2 }} role="alert">
            {submitError}
          </Typography>
        )}
        {/* Botón finalizar */}
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          disabled={submitting}
          onClick={handleFinalizarCompra}
          sx={{
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: '8px',
            textTransform: 'none',
            color: COLORS.white,
            boxShadow: `0 4px 14px rgba(9,9,11,0.18)`,
            '&:hover': {
              boxShadow: `0 6px 20px rgba(9,9,11,0.22)`,
            },
          }}
        >
          {submitting ? (
            <>
              <CircularProgress size={22} sx={{ color: 'inherit', mr: 1 }} />
              Redirigiendo a Mercado Pago...
            </>
          ) : (
            'Finalizar compra'
          )}
        </Button>

        <Typography variant="body2" align="center" sx={{ mt: 2, color: COLORS.textSecondary }}>
          Tipo de cambio utilizado: 1 USD = $ {formatArs(rate)} ARS
        </Typography>
      </Container>
    </Box>
  );
}
