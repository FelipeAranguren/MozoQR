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
      variant="warning"
      kicker="Permisos"
      icon={<BlockIcon sx={{ fontSize: 56, color: '#d97706' }} />}
      title="No tienes acceso a esta URL"
      description={errorMessage || "Verifica tu cuenta o los permisos del restaurante antes de continuar."}
    >
      <Button
        component={Link}
        to={loginTo}
        variant="contained"
        fullWidth
        sx={{
          maxWidth: 380,
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
          py: 1.25,
          bgcolor: '#0d9488',
          '&:hover': { bgcolor: '#0d9488', filter: 'brightness(0.9)' },
        }}
      >
        Iniciar sesión
      </Button>
      <Button
        component={Link}
        to="/"
        variant="outlined"
        fullWidth
        sx={{
          maxWidth: 380,
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
          py: 1.25,
          color: '#52525b',
          borderColor: '#e4e4e7',
          '&:hover': { borderColor: '#a1a1aa', bgcolor: '#fafafa' },
        }}
      >
        Volver al inicio
      </Button>
    </StatusPage>
  );
}
