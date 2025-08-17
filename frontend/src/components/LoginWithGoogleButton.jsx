import React from "react";
import { Button } from "@mui/material";
import { FcGoogle } from "react-icons/fc"; // icono de Google (paquete react-icons)

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";

export default function LoginWithGoogleButton() {
  const url = `${STRAPI_URL}/connect/google`;

  return (
    <Button
      variant="outlined"           // bordes y estilo limpio
      startIcon={<FcGoogle />}     // ícono al inicio
      color="inherit"              // para que siga el color del AppBar
      component="a"
      href={url}
      sx={{
        borderColor: "white",      // borde blanco en el header oscuro
        color: "white",            // texto blanco
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.1)", // fondo suave al pasar
          borderColor: "white",
        },
        textTransform: "none",     // evita que el texto esté en mayúsculas
      }}
    >
      Iniciar sesión con Google
    </Button>
  );
}
