import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import StatusPage from "../components/ui/StatusPage";

export default function NoAccess() {
  const location = useLocation();
  const errorMessage = location.state?.error || null;
  const from = location.state?.from || null;
  const loginTo =
    from && typeof window !== "undefined"
      ? `/login?callbackUrl=${encodeURIComponent(`${window.location.origin}${from}`)}`
      : "/login";

  return (
    <StatusPage
      kicker="Permisos"
      icon={<BlockIcon sx={{ fontSize: 72, color: "error.main" }} />}
      title="No tienes acceso a esta URL"
      description={errorMessage || "Verifica tu cuenta o los permisos del restaurante antes de continuar."}
    >
      <Button component={Link} to={loginTo} variant="contained" fullWidth sx={{ maxWidth: 420 }}>
        Iniciar sesión
      </Button>
      <Button component={Link} to="/" variant="outlined" fullWidth sx={{ maxWidth: 420 }}>
        Volver al inicio
      </Button>
    </StatusPage>
  );
}
