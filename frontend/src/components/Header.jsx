import React from "react";
import { AppBar, Toolbar, Typography, Button, Link, Box } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildLoginPathWithCurrentUrl, buildRegisterPathWithCurrentUrl } from "../utils/authRedirect";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
          bgcolor: 'background.paper',
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
                }}
              >
                M
              </Box>
              <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                MozoQR
              </Typography>
            </Box>
          </Link>

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
      <Toolbar />
    </>
  );
}
