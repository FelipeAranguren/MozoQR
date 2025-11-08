// frontend/src/pages/owner/tables/TablesList.jsx
import React from 'react';
import { Box, Typography, Container } from '@mui/material';

export default function TablesList() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Gestión de Mesas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aquí podrás gestionar las mesas de tu restaurante.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          🚧 Esta sección está en desarrollo. Próximamente podrás crear, editar y eliminar mesas.
        </Typography>
      </Box>
    </Container>
  );
}