import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc"; // icono de Google

// En localhost siempre usar el backend local; en producción usar env
function getApiBase() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalhost) return "http://localhost:1337";
  const u = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api";
  const base = (u || "").replace(/\/api\/?$/, "") || "http://localhost:1337";
  return base;
}

// Claves consistentes
const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

export default function LoginWithGoogleButton() {
  // Forzamos selector de cuenta para evitar “reusar” sesión previa
  const apiBase = getApiBase();
  const redirectPath = typeof window !== "undefined" ? `${window.location.origin}/connect/google/redirect` : "";
  const url = redirectPath
    ? `${apiBase}/api/connect/google?prompt=select_account&callback=${encodeURIComponent(redirectPath)}`
    : `${apiBase}/api/connect/google?prompt=select_account`;

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
