// Página de retorno de Mercado Pago cuando el pago falló o fue rechazado (back_urls.failure).
// auto_return: 'approved' redirige a /payment-success; si el usuario cancela o falla, MP redirige aquí.
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Typography, Button, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function PaymentFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");

  return (
    <Container maxWidth="sm" sx={{ py: 6, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <ErrorOutlineIcon sx={{ fontSize: 56, color: "error.main", mb: 2 }} />
        <Typography variant="h6" color="text.primary" gutterBottom>
          El pago no pudo completarse
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Podés intentar de nuevo o elegir otro método de pago.
        </Typography>
        {slug && (
          <Button variant="contained" onClick={() => navigate(`/${slug}/menu`)} sx={{ mr: 1 }}>
            Volver al menú
          </Button>
        )}
        <Button variant="outlined" onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
      </Box>
    </Container>
  );
}
