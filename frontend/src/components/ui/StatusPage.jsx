import React from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

const VARIANT_STYLES = {
  success: { accent: '#16a34a', bg: '#f0fdf4', iconBg: 'rgba(22,163,74,0.08)' },
  error:   { accent: '#dc2626', bg: '#fef2f2', iconBg: 'rgba(220,38,38,0.08)' },
  warning: { accent: '#d97706', bg: '#fffbeb', iconBg: 'rgba(217,119,6,0.08)' },
  info:    { accent: '#0284c7', bg: '#f0f9ff', iconBg: 'rgba(2,132,199,0.08)' },
  neutral: { accent: '#0d9488', bg: '#fafafa', iconBg: 'rgba(13,148,136,0.06)' },
};

export default function StatusPage({
  kicker = 'Estado',
  icon,
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
  variant = 'neutral',
  children,
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, sm: 6 },
        px: { xs: 2, sm: 3 },
        bgcolor: v.bg,
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4.5 },
            textAlign: 'center',
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            bgcolor: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              bgcolor: v.accent,
            },
          }}
        >
          <Stack spacing={2} sx={{ alignItems: 'center', pt: 1 }}>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: v.accent,
              }}
            >
              {kicker}
            </Typography>

            {icon ? (
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  bgcolor: v.iconBg,
                }}
              >
                {icon}
              </Box>
            ) : null}

            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, color: '#09090b', lineHeight: 1.25 }}
            >
              {title}
            </Typography>

            {description ? (
              <Typography
                variant="body1"
                sx={{ color: '#52525b', maxWidth: 440, px: { xs: 0, sm: 1 }, lineHeight: 1.6 }}
              >
                {description}
              </Typography>
            ) : null}

            {detail ? (
              <Typography
                variant="body2"
                sx={{ color: '#52525b', maxWidth: 420, px: { xs: 0, sm: 1 }, lineHeight: 1.5 }}
              >
                {detail}
              </Typography>
            ) : null}

            {children}

            {(primaryAction || secondaryAction) && (
              <Stack spacing={1.5} sx={{ width: '100%', mt: 1, maxWidth: 380, mx: 'auto' }}>
                {primaryAction ? (
                  <Button
                    variant={primaryAction.variant || 'contained'}
                    size="large"
                    fullWidth
                    onClick={primaryAction.onClick}
                    startIcon={primaryAction.startIcon}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.25,
                      ...((!primaryAction.variant || primaryAction.variant === 'contained') && {
                        bgcolor: v.accent,
                        '&:hover': { bgcolor: v.accent, filter: 'brightness(0.9)' },
                      }),
                      ...(primaryAction.variant === 'outlined' && {
                        color: v.accent,
                        borderColor: v.accent,
                        '&:hover': { borderColor: v.accent, bgcolor: `${v.accent}0a` },
                      }),
                    }}
                  >
                    {primaryAction.label}
                  </Button>
                ) : null}
                {secondaryAction ? (
                  <Button
                    variant={secondaryAction.variant || 'outlined'}
                    size="large"
                    fullWidth
                    onClick={secondaryAction.onClick}
                    startIcon={secondaryAction.startIcon}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.25,
                      ...(secondaryAction.variant === 'contained' && {
                        bgcolor: v.accent,
                        '&:hover': { bgcolor: v.accent, filter: 'brightness(0.9)' },
                      }),
                      ...((!secondaryAction.variant || secondaryAction.variant === 'outlined') && {
                        color: '#52525b',
                        borderColor: '#e4e4e7',
                        '&:hover': { borderColor: '#a1a1aa', bgcolor: '#fafafa' },
                      }),
                    }}
                  >
                    {secondaryAction.label}
                  </Button>
                ) : null}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
