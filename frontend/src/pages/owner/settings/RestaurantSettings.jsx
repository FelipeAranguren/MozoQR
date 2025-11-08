// frontend/src/pages/owner/settings/RestaurantSettings.jsx
import React from 'react';
import { Box, Typography, Container } from '@mui/material';

export default function RestaurantSettings() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Configuración del Restaurante
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aquí podrás editar los datos de tu restaurante, logo, colores, etc.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          🚧 Esta sección está en desarrollo. Próximamente podrás editar toda la configuración de tu restaurante.
        </Typography>
      </Box>
    </Container>
  );
}
