// frontend/src/components/PaymentRequestAlertBanner.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

/**
 * Banner superior fijo que alerta cuando hay mesas solicitando la cuenta (estado violeta).
 * Solo se muestra si tableNumbers.length > 0.
 * Desaparece automáticamente cuando ya no hay mesas en ese estado.
 */
export default function PaymentRequestAlertBanner({ tableNumbers = [] }) {
  if (!Array.isArray(tableNumbers) || tableNumbers.length === 0) return null;

  const sorted = [...tableNumbers].filter((n) => n != null && n !== '').map(Number).sort((a, b) => a - b);
  const text =
    sorted.length === 0
      ? ''
      : sorted.length === 1
        ? `Mesa ${sorted[0]} solicitando cobro`
        : `Mesas ${sorted.join(', ')} solicitando cobro`;

  return (
    <Box
      component="header"
      role="alert"
      sx={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: 1.25,
        px: 2,
        background: 'linear-gradient(135deg, #7b1fa2 0%, #9c27b0 50%, #ab47bc 100%)',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(156, 39, 176, 0.45)',
        borderBottom: '3px solid rgba(255,255,255,0.3)',
        animation: 'paymentBannerPulse 2s ease-in-out infinite',
        '@keyframes paymentBannerPulse': {
          '0%, 100%': { boxShadow: '0 4px 20px rgba(156, 39, 176, 0.45)' },
          '50%': { boxShadow: '0 4px 28px rgba(156, 39, 176, 0.6)' },
        },
      }}
    >
      <AccountBalanceWalletIcon sx={{ fontSize: 28, opacity: 0.95 }} />
      <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
        ¡Atención! Hay mesas solicitando la cuenta.
      </Typography>
      <Typography variant="body1" component="span" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' }, opacity: 0.95 }}>
        {text}
      </Typography>
    </Box>
  );
}
