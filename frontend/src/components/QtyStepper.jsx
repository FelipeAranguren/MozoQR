// src/components/QtyStepper.jsx
import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

export default function QtyStepper({ value = 0, onAdd, onSub }) {
  const menosActivo = value > 0;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        p: 0.5,
        borderRadius: 'var(--mq-radius-sm)',
        bgcolor: 'var(--mq-bg-alt)',
        border: '1px solid',
        borderColor: 'var(--mq-border)',
      }}
    >
      <IconButton
        size="small"
        onClick={onSub}
        disabled={!menosActivo}
        sx={{
          width: 34,
          height: 34,
          color: menosActivo ? 'var(--mq-text)' : 'var(--mq-text-muted)',
          bgcolor: menosActivo ? 'var(--mq-surface)' : 'transparent',
          '&:hover': menosActivo ? { bgcolor: 'var(--mq-surface)' } : {},
        }}
        aria-label="Restar"
      >
        <RemoveIcon fontSize="small" />
      </IconButton>

      <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 800, color: 'var(--mq-text)' }}>
        {value}
      </Typography>

      <IconButton
        size="small"
        onClick={onAdd}
        sx={{
          width: 34,
          height: 34,
          bgcolor: 'var(--mq-primary)',
          color: '#fff',
          '&:hover': {
            bgcolor: 'var(--mq-primary)',
            opacity: 0.85,
          },
        }}
        aria-label="Sumar"
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
