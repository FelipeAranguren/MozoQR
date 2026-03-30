import React from "react";
import { AppBar, Toolbar, Typography, Button, Link } from "@mui/material";
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
        elevation={2}
        sx={{
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
      <Toolbar
        sx={{
          flexWrap: 'nowrap',
          gap: 1,
          maxWidth: '100%',
          px: { xs: 1.5, sm: 2 },
        }}
      >
        {isRestaurantMenuFlow ? (
          <Typography variant="h6" noWrap sx={{ flexShrink: 0, mr: 'auto' }}>
            MozoQR
          </Typography>
        ) : (
          <Link
            component={RouterLink}
            to="/"
            color="inherit"
            underline="none"
            sx={{ flexShrink: 0, mr: 'auto' }}
          >
            <Typography variant="h6" noWrap>
              MozoQR
            </Typography>
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
            <Button color="inherit" onClick={handleLogout} sx={{ flexShrink: 0, px: { xs: 1, sm: 2 } }}>
              Salir
            </Button>
          </>
        ) : (
          <>
            <Button 
              color="inherit" 
              onClick={() => navigate(buildLoginPathWithCurrentUrl())}
              sx={{ mr: 1 }}
            >
              Iniciar sesión
            </Button>
            <Button 
              color="inherit" 
              variant="outlined"
              onClick={() => navigate(buildRegisterPathWithCurrentUrl())}
              sx={{
                borderColor: "white",
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderColor: "white",
                }
              }}
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
