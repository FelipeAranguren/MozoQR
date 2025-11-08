// frontend/src/pages/owner/plan/PlanManagement.jsx
import React from 'react';
import { Box, Typography, Container } from '@mui/material';

export default function PlanManagement() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Gestión de Plan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Aquí podrás ver y gestionar tu plan actual.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          🚧 Esta sección está en desarrollo. Próximamente podrás ver tu plan actual y hacer upgrade.
        </Typography>
      </Box>
    </Container>
  );
}