import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc";
import { persistReturnUrlBeforeOAuth } from "../utils/authRedirect";

const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

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
  const redirectPath = typeof window !== "undefined" ? `${window.location.origin}/connect/google/redirect` : "";
  const url = redirectPath
    ? `${apiBase}/api/connect/google?prompt=select_account&callback=${encodeURIComponent(redirectPath)}`
    : `${apiBase}/api/connect/google?prompt=select_account`;

  const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

  const handleClick = (e) => {
    e.preventDefault();
    persistReturnUrlBeforeOAuth();
    localStorage.removeItem(LS_JWT_KEY);
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem("jwt");
    if (isMobile) {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
  };

  return (
    <Button
      variant="outlined"
      fullWidth
      startIcon={<FcGoogle />}
      onClick={handleClick}
      sx={{
        borderColor: 'var(--mq-border-strong)',
        color: 'var(--mq-text)',
        backgroundColor: 'var(--mq-surface)',
        textTransform: "none",
        fontSize: "0.95rem",
        fontWeight: 600,
        py: 1.5,
        borderRadius: 'var(--mq-radius-sm)',
        boxShadow: "none",
        "&:hover": {
          backgroundColor: 'var(--mq-bg-alt)',
          borderColor: 'var(--mq-text-muted)',
          boxShadow: "none",
        },
      }}
    >
      {mode === "register" ? "Registrarse con Google" : "Iniciar sesión con Google"}
    </Button>
  );
}
