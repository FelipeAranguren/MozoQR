import React from 'react';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';

export default function AuthCardShell({
  eyebrow = 'MozoQR',
  title,
  description,
  children,
  maxWidth = 'sm',
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, sm: 6 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth={maxWidth}>
        <Paper
          component={motion.div}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="premium-panel"
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            position: 'relative',
            borderLeft: '3px solid',
            borderLeftColor: 'primary.main',
          }}
        >
          <Stack spacing={1.5} sx={{ position: 'relative' }}>
            <Typography className="premium-kicker">{eyebrow}</Typography>
            <Typography variant="h3" component="h1">
              {title}
            </Typography>
            {description ? (
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, pt: 0.5 }}>
                {description}
              </Typography>
            ) : null}
          </Stack>
          <Box sx={{ mt: 3.5, position: 'relative' }}>{children}</Box>
        </Paper>
      </Container>
    </Box>
  );
}
