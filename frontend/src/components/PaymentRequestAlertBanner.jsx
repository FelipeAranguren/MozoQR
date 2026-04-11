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
        py: 1.1,
        px: 2,
        background: 'var(--mq-primary)',
        color: '#fff',
        boxShadow: 'var(--mq-shadow-2)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        animation: 'paymentBannerPulse 2s ease-in-out infinite',
        '@keyframes paymentBannerPulse': {
          '0%, 100%': { boxShadow: '0 4px 20px rgba(9, 9, 11, 0.25)' },
          '50%': { boxShadow: '0 4px 28px rgba(9, 9, 11, 0.4)' },
        },
      }}
    >
      <AccountBalanceWalletIcon sx={{ fontSize: 28, opacity: 0.95 }} />
      <Typography variant="h6" component="span" sx={{ fontWeight: 800, fontSize: { xs: '0.98rem', sm: '1.05rem' }, letterSpacing: '-0.02em' }}>
        ¡Atención! Hay mesas solicitando la cuenta.
      </Typography>
      <Typography variant="body1" component="span" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' }, opacity: 0.95 }}>
        {text}
      </Typography>
    </Box>
  );
}
