// frontend/src/pages/owner/menu/MenuManagement.jsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Container } from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import ProductsManagement from './ProductsManagement';
import CategoriesManagement from './CategoriesManagement';

export default function MenuManagement() {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Gestión de Menú
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra tus productos y categorías
        </Typography>
      </Box>

      <Box
        sx={{
          borderBottom: 1,
          borderColor: MARANA_COLORS.border,
          mb: 3
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '15px',
              minHeight: 48
            },
            '& .Mui-selected': {
              color: MARANA_COLORS.primary
            },
            '& .MuiTabs-indicator': {
              backgroundColor: MARANA_COLORS.primary,
              height: 3
            }
          }}
        >
          <Tab label="Productos" />
          <Tab label="Categorías" />
        </Tabs>
      </Box>

      {activeTab === 0 && <ProductsManagement slug={slug} />}
      {activeTab === 1 && <CategoriesManagement slug={slug} />}
    </Container>
  );
}
