import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc"; // icono de Google

const STRAPI_URL = import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api";

// Claves consistentes
const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

export default function LoginWithGoogleButton() {
  // Forzamos selector de cuenta para evitar “reusar” sesión previa
  const url = `${STRAPI_URL}/connect/google?prompt=select_account`;

  const handleLogin = (e) => {
    e.preventDefault();
    // 🧹 Limpia cualquier sesión previa (DEV o social)
    localStorage.removeItem(LS_JWT_KEY);
    localStorage.removeItem(LS_USER_KEY);
    // Redirige al flujo de OAuth
    window.location.href = url;
  };

  return (
    <Button
      variant="outlined"
      startIcon={<FcGoogle />}
      color="inherit"
      onClick={handleLogin}
      sx={{
        borderColor: "white",
        color: "white",
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.1)",
          borderColor: "white",
        },
        textTransform: "none",
      }}
    >
      Iniciar sesión con Google
    </Button>
  );
}
