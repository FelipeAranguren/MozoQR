import React from "react";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();           // limpia strapi_jwt/strapi_user y resetea contexto
    // si prefieres no usar window.location en AuthContext:
    // navigate("/", { replace: true });
  };

  return (
    <AppBar position="static" sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <Toolbar
        sx={{
          flexWrap: 'nowrap',
          gap: 1,
          maxWidth: '100%',
          px: { xs: 1.5, sm: 2 },
        }}
      >
        <Typography variant="h6" noWrap sx={{ flexShrink: 0, mr: 'auto' }}>
          MozoQR
        </Typography>

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
              onClick={() => navigate("/login")}
              sx={{ mr: 1 }}
            >
              Iniciar sesión
            </Button>
            <Button 
              color="inherit" 
              variant="outlined"
              onClick={() => navigate("/register")}
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
  );
}
