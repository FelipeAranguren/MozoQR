import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc"; // icono de Google (paquete react-icons)

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";

export default function LoginWithGoogleButton() {
  const url = `${STRAPI_URL}/connect/google`;

  const handleLogin = (e) => {
    e.preventDefault();
    // 🧹 Limpia cualquier JWT previo (por ejemplo, el del login DEV)
    localStorage.removeItem("jwt");
    // Redirige al flujo de OAuth
    window.location.href = url;
  };

  return (
    <Button
      variant="outlined"
      startIcon={<FcGoogle />}
      color="inherit"
      onClick={handleLogin} // 👈 reemplaza el href directo
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
