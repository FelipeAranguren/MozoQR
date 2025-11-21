import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc";

// Claves consistentes
const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

// Mantener el mismo patrón que LoginWithGoogleButton original
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || import.meta.env.VITE_API_URL || "http://localhost:1337/api";

export default function GoogleButton({ onSuccess, mode = "login" }) {
  // Forzamos selector de cuenta para evitar "reusar" sesión previa
  const url = `${STRAPI_URL}/connect/google?prompt=select_account`;

  const handleClick = (e) => {
    e.preventDefault();
    // Limpia cualquier sesión previa (DEV o social)
    localStorage.removeItem(LS_JWT_KEY);
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem("jwt");
    // Redirige al flujo de OAuth
    window.location.href = url;
  };

  return (
    <Button
      variant="outlined"
      fullWidth
      startIcon={<FcGoogle />}
      onClick={handleClick}
      sx={{
        borderColor: "#dadce0",
        color: "#3c4043",
        backgroundColor: "white",
        textTransform: "none",
        fontSize: "14px",
        fontWeight: 500,
        py: 1.5,
        "&:hover": {
          backgroundColor: "#f8f9fa",
          borderColor: "#dadce0",
          boxShadow: "0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.24)",
        },
        boxShadow: "0 1px 2px rgba(0,0,0,.08)",
      }}
    >
      {mode === "register" ? "Registrarse con Google" : "Iniciar sesión con Google"}
    </Button>
  );
}

