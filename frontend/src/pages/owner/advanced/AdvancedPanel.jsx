// frontend/src/pages/owner/advanced/AdvancedPanel.jsx
import React from 'react';
import { Box, Typography, Container, Button, Link } from '@mui/material';
import { useParams } from 'react-router-dom';

export default function AdvancedPanel() {
  const { slug } = useParams();
  const strapiAdminUrl = `http://localhost:1337/admin/content-manager/collection-types/api::restaurante.restaurante`;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Panel Avanzado
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Acceso a configuraciones avanzadas y panel de administración de Strapi.
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            component={Link}
            href={strapiAdminUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mr: 2 }}
          >
            Abrir Strapi Admin
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            ⚠️ El panel de Strapi Admin requiere permisos de administrador.
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
