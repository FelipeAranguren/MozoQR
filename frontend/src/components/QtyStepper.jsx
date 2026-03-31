// src/components/QtyStepper.jsx
import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

export default function QtyStepper({ value = 0, onAdd, onSub }) {
  const menosActivo = value > 0; // true si puede restar

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        p: 0.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IconButton
        size="small"
        onClick={onSub}
        disabled={!menosActivo}
        sx={{
          width: 34,
          height: 34,
          color: menosActivo ? 'primary.main' : 'text.disabled',
          bgcolor: menosActivo ? 'background.paper' : 'transparent',
          '&:hover': menosActivo ? { bgcolor: 'background.paper' } : {},
        }}
        aria-label="Restar"
      >
        <RemoveIcon fontSize="small" />
      </IconButton>

      <Typography sx={{ minWidth: 22, textAlign: 'center', fontWeight: 800, color: 'text.primary' }}>
        {value}
      </Typography>

      <IconButton
        size="small"
        onClick={onAdd}
        sx={{
          width: 34,
          height: 34,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
        }}
        aria-label="Sumar"
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}