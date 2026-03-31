import React from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

export default function StatusPage({
  kicker = 'Estado',
  icon,
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
  children,
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 4, sm: 6 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          className="premium-panel"
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4.5 },
            textAlign: 'center',
            position: 'relative',
            borderTop: '3px solid',
            borderTopColor: 'primary.main',
          }}
        >
          <Stack spacing={1.75} sx={{ position: 'relative', alignItems: 'center' }}>
            <Typography className="premium-kicker">{kicker}</Typography>
            {icon ? <Box sx={{ display: 'grid', placeItems: 'center', mb: 0.5 }}>{icon}</Box> : null}
            <Typography variant="h3" component="h1">
              {title}
            </Typography>
            {description ? (
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, px: { xs: 0, sm: 1 } }}>
                {description}
              </Typography>
            ) : null}
            {detail ? (
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, px: { xs: 0, sm: 1 } }}>
                {detail}
              </Typography>
            ) : null}
            {children}
            {(primaryAction || secondaryAction) && (
              <Stack spacing={1.5} sx={{ width: '100%', mt: 2, maxWidth: 400, mx: 'auto' }}>
                {primaryAction ? (
                  <Button
                    variant={primaryAction.variant || 'contained'}
                    size="large"
                    fullWidth
                    onClick={primaryAction.onClick}
                    startIcon={primaryAction.startIcon}
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
