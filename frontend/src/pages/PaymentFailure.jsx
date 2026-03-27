// Página de retorno de Mercado Pago cuando el pago falló o fue rechazado (back_urls.failure).
// auto_return: 'approved' redirige a /payment-success; si el usuario cancela o falla, MP redirige aquí.
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Typography, Button, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const REASON_HINTS = {
  config_error: "No pudimos validar el pago con el restaurante (credenciales o conexión). Si Mercado Pago mostró el cobro como aprobado, avisá en el local.",
  no_order_ref: "No se pudo asociar el cobro al pedido. Si ya te descontaron, pedí ayuda en el mostrador.",
  order_not_found: "No encontramos el pedido en el sistema. Si ya pagaste, conservá el comprobante de MP y avisá en el local.",
  error: "Hubo un error al confirmar el pago. Si MP mostró aprobado, puede ser solo sincronización: probá volver al menú desde el QR.",
};

export default function PaymentFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  const reason = searchParams.get("reason") || "";
  const reasonHint = REASON_HINTS[reason] || null;

  return (
    <Container maxWidth="sm" sx={{ py: 6, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <ErrorOutlineIcon sx={{ fontSize: 56, color: "error.main", mb: 2 }} />
        <Typography variant="h6" color="text.primary" gutterBottom>
          El pago no pudo completarse
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Podés intentar de nuevo o elegir otro método de pago.
        </Typography>
        {reasonHint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, px: 1 }}>
            {reasonHint}
          </Typography>
        )}
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
