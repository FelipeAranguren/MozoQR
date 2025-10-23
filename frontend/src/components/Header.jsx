import React from "react";
import { AppBar, Toolbar, Typography, Button, Link } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import LoginWithGoogleButton from "./LoginWithGoogleButton";
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
    <AppBar position="static">
      <Toolbar>
        <Link component={RouterLink} to="/" color="inherit" underline="none" sx={{ flexGrow: 1 }}>
          <Typography variant="h6">MozoQR</Typography>
        </Link>

        {isAuthenticated ? (
          <>
            <Typography sx={{ mr: 2 }}>
              {user?.username || user?.email || "Usuario"}
            </Typography>
            <Button color="inherit" onClick={handleLogout}>Salir</Button>
          </>
        ) : (
          <LoginWithGoogleButton />
        )}
      </Toolbar>
    </AppBar>
  );
}
