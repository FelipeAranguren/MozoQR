// src/components/QtyStepper.jsx
import React from 'react';
import { Box, Button, Typography } from '@mui/material';

export default function QtyStepper({ value = 0, onAdd, onSub }) {
  const menosActivo = value > 0; // true si puede restar

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button
        variant="outlined"
        size="small"
        onClick={onSub}
        disabled={!menosActivo}
        sx={{
          minWidth: 36,
          px: 0,
          lineHeight: 1.2,
          fontWeight: 700,
          borderColor: menosActivo ? 'error.main' : undefined,
          color: menosActivo ? 'error.main' : undefined,
          '&:hover': menosActivo ? { borderColor: 'error.dark', backgroundColor: 'error.light' } : {}
        }}
        aria-label="Restar"
      >
        –
      </Button>

      <Typography sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>
        {value}
      </Typography>

      <Button
        variant="outlined"
        size="small"
        onClick={onAdd}
        sx={{ minWidth: 36, px: 0, lineHeight: 1.2, fontWeight: 700 }}
        aria-label="Sumar"
      >
        +
      </Button>
    </Box>
  );
}