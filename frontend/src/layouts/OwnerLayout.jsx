import React, { useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Box, Drawer, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import OwnerSidebar from '../components/owner/OwnerSidebar';
import OwnerHeader from '../components/owner/OwnerHeader';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_MOBILE = 280;

export default function OwnerLayout() {
  const { slug } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => setMobileOpen((v) => !v);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <OwnerHeader slug={slug} onMenuClick={isMobile ? handleDrawerToggle : undefined} />
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        sx={{
          width: isMobile ? DRAWER_WIDTH_MOBILE : DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isMobile ? DRAWER_WIDTH_MOBILE : DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            top: { xs: 56, sm: 64 },
            height: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
            px: 1,
            bgcolor: 'background.paper',
          },
        }}
      >
        <Toolbar sx={{ display: { xs: 'block', md: 'none' }, minHeight: { xs: 56, sm: 64 } }} />
        <OwnerSidebar slug={slug} onNavigate={isMobile ? handleDrawerToggle : undefined} />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 2.5, md: 3 },
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          overflowX: 'hidden',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
