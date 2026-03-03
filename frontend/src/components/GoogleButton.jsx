import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc";

// Claves consistentes
const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

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

export default function GoogleButton({ onSuccess, mode = "login" }) {
  const apiBase = getApiBase();
  // Strapi acepta ?callback= para redirigir aquí tras OAuth (doc: query.callback en auth.connect)
  const redirectPath = typeof window !== "undefined" ? `${window.location.origin}/connect/google/redirect` : "";
  const url = redirectPath
    ? `${apiBase}/api/connect/google?prompt=select_account&callback=${encodeURIComponent(redirectPath)}`
    : `${apiBase}/api/connect/google?prompt=select_account`;

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

