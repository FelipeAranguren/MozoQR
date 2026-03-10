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
import { MARANA_COLORS } from '../theme';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { formatArs } from '../api/exchangeRate';
import { PLAN_BASE_USD } from '../constants/planPricing';

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
  { key: 'basic', planKey: 'BASIC', name: 'Básico', priceUsd: PLAN_BASE_USD.BASIC, color: MARANA_COLORS.textSecondary },
  { key: 'pro', planKey: 'PRO', name: 'Pro', priceUsd: PLAN_BASE_USD.PRO, color: MARANA_COLORS.secondary },
  { key: 'ultra', planKey: 'ULTRA', name: 'Ultra', priceUsd: PLAN_BASE_USD.ULTRA, color: MARANA_COLORS.primary },
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

  const planOption = PLAN_OPTIONS.find((p) => p.key === selectedPlan) || PLAN_OPTIONS[0];
  const totalArs = planOption.priceUsd * rate;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: MARANA_COLORS.background,
        py: { xs: 3, md: 5 },
        px: 1,
      }}
    >
      <Container maxWidth="md">
        <Typography variant="h4" fontWeight="bold" align="center" gutterBottom sx={{ color: MARANA_COLORS.textPrimary }}>
          Completar tu suscripción
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Elige tu plan y método de pago
        </Typography>

        {/* Selector de plan */}
        <Card sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', border: `1px solid ${MARANA_COLORS.border}` }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: MARANA_COLORS.textPrimary }}>
              Plan
            </Typography>
            <Tabs
              value={selectedPlan}
              onChange={(_, v) => setSelectedPlan(v)}
              variant={isMobile ? 'fullWidth' : 'standard'}
              sx={{
                minHeight: 48,
                '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' },
                '& .Mui-selected': { color: planOption.color },
                '& .MuiTabs-indicator': { bgcolor: planOption.color, height: 3 },
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
                        <CircularProgress size={16} sx={{ color: opt.color }} />
                      ) : (
                        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
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
        <Card sx={{ mb: 3, borderRadius: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: MARANA_COLORS.textPrimary }}>
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
                    border: `2px solid ${paymentMethod === 'mercadopago' ? MARANA_COLORS.primary : MARANA_COLORS.border}`,
                    borderRadius: 2,
                    bgcolor: paymentMethod === 'mercadopago' ? alpha(MARANA_COLORS.primary, 0.04) : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: alpha(MARANA_COLORS.primary, 0.5) },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      value="mercadopago"
                      control={<Radio sx={{ color: MARANA_COLORS.primary, '&.Mui-checked': { color: MARANA_COLORS.primary } }} />}
                      label=""
                      sx={{ m: 0 }}
                    />
                    <MercadoPagoLogo />
                    <Box>
                      <Typography fontWeight="600" color="text.primary">
                        Mercado Pago
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
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
            borderRadius: 3,
            border: `2px solid ${planOption.color}`,
            bgcolor: alpha(planOption.color, 0.04),
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ mb: 2, color: MARANA_COLORS.textPrimary }}>
              Resumen de compra
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="text.secondary">Plan seleccionado</Typography>
                <Typography fontWeight="600" sx={{ color: planOption.color }}>
                  {planOption.name}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="text.secondary">Precio en USD</Typography>
                <Typography fontWeight="600">USD {planOption.priceUsd}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography color="text.secondary">Valor del dólar actual</Typography>
                <Typography fontWeight="600">$ {formatArs(rate)} ARS</Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                  pt: 2,
                  borderTop: `1px solid ${MARANA_COLORS.border}`,
                }}
              >
                <Typography variant="h6" fontWeight="700" color="text.primary">
                  Total
                </Typography>
                <Typography variant="h5" fontWeight="800" sx={{ color: planOption.color }}>
                  $ {formatArs(totalArs)} ARS
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Botón finalizar */}
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => {
            console.log('Checkout: Finalizar compra', { plan: selectedPlan, paymentMethod, totalArs });
            alert('Próximamente');
          }}
          sx={{
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 700,
            borderRadius: 2,
            textTransform: 'none',
            bgcolor: planOption.color,
            boxShadow: `0 4px 14px ${alpha(planOption.color, 0.4)}`,
            '&:hover': {
              bgcolor: planOption.color,
              filter: 'brightness(0.92)',
              boxShadow: `0 6px 20px ${alpha(planOption.color, 0.45)}`,
            },
          }}
        >
          Finalizar compra
        </Button>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          Tipo de cambio utilizado: 1 USD = $ {formatArs(rate)} ARS
        </Typography>
      </Container>
    </Box>
  );
}
