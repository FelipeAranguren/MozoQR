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
        bgcolor: '#fafafa',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <Container maxWidth={maxWidth}>
        <Paper
          component={motion.div}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            position: 'relative',
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            bgcolor: '#ffffff',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '3px',
              bgcolor: '#0d9488',
            },
          }}
        >
          <Stack spacing={1.5} sx={{ position: 'relative' }}>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#0d9488',
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, color: '#09090b' }}
            >
              {title}
            </Typography>
            {description ? (
              <Typography
                variant="body1"
                sx={{ color: '#52525b', maxWidth: 520, pt: 0.5, lineHeight: 1.6 }}
              >
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
