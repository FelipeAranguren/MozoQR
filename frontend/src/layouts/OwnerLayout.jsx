// frontend/src/layouts/OwnerLayout.jsx
import React from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { Box, Drawer, Toolbar } from '@mui/material';
import OwnerSidebar from '../components/owner/OwnerSidebar';
import OwnerHeader from '../components/owner/OwnerHeader';

const DRAWER_WIDTH = 280;

export default function OwnerLayout() {
  const { slug } = useParams();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex' }}>
      <OwnerHeader slug={slug} />
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        <OwnerSidebar slug={slug} currentPath={location.pathname} />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
