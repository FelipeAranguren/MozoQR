import React from "react";
import { AppBar, Toolbar, Typography, Button, Link, Box } from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildLoginPathWithCurrentUrl, buildRegisterPathWithCurrentUrl } from "../utils/authRedirect";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // En el menú público del restaurante no queremos que el cliente salga a la landing.
  // Rutas del flujo: "/:slug" y "/:slug/menu" (y subrutas bajo /menu si existieran).
  const isRestaurantMenuFlow =
    /^\/[^/]+\/menu(?:\/|$)/.test(location.pathname) || /^\/[^/]+\/?$/.test(location.pathname);

  const handleLogout = () => {
    logout();           // limpia strapi_jwt/strapi_user y resetea contexto
    // si prefieres no usar window.location en AuthContext:
    // navigate("/", { replace: true });
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          zIndex: (theme) => theme.zIndex.appBar,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
      <Toolbar
        sx={{
          flexWrap: 'nowrap',
          gap: 1,
          maxWidth: '100%',
          px: { xs: 1.5, sm: 2.5 },
          minHeight: { xs: 64, sm: 72 },
        }}
      >
        {isRestaurantMenuFlow ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0, mr: 'auto' }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 800,
                fontSize: '0.9rem',
                boxShadow: 'none',
              }}
            >
              M
            </Box>
            <Typography variant="h6" noWrap sx={{ flexShrink: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
              MozoQR
            </Typography>
          </Box>
        ) : (
          <Link
            component={RouterLink}
            to="/"
            color="inherit"
            underline="none"
            sx={{ flexShrink: 0, mr: 'auto' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  boxShadow: 'none',
                }}
              >
                M
              </Box>
              <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                MozoQR
              </Typography>
            </Box>
          </Link>
        )}

        {isAuthenticated ? (
          <>
            <Typography
              variant="body2"
              sx={{
                mr: { xs: 0.5, sm: 2 },
                minWidth: 0,
                maxWidth: { xs: 'min(42vw, 9rem)', sm: '14rem' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              {user?.username || user?.email || "Usuario"}
            </Typography>
            <Button color="inherit" onClick={handleLogout} variant="outlined" sx={{ flexShrink: 0, px: { xs: 1.25, sm: 2 } }}>
              Salir
            </Button>
          </>
        ) : (
          <>
            <Button 
              color="inherit"
              onClick={() => navigate(buildLoginPathWithCurrentUrl())}
              sx={{ mr: 0.75 }}
            >
              Iniciar sesión
            </Button>
            <Button 
              color="primary"
              variant="contained"
              onClick={() => navigate(buildRegisterPathWithCurrentUrl())}
            >
              Registrarse
            </Button>
          </>
        )}
      </Toolbar>
      </AppBar>
      {/* Reserva la altura del AppBar: sin esto el contenido queda debajo del fixed y sticky fallaba con #root { height:100% }. */}
      <Toolbar />
    </>
  );
}
