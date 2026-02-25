// Página de retorno de Mercado Pago cuando el pago fue aprobado (auto_return: 'approved').
// back_urls.success apunta aquí. Muestra "Procesando tu pedido..." mientras el webhook actualiza la orden.
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Container, CircularProgress, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const isPending = status === "pending";
  const [message, setMessage] = useState(
    isPending ? "Tu pago está pendiente de acreditación." : "Procesando tu pedido…"
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setMessage(
        isPending
          ? "Cuando se acredite, el pedido se actualizará en el mostrador."
          : "¡Listo! Tu pago fue acreditado."
      );
      setDone(true);
    }, isPending ? 2000 : 4000);
    return () => clearTimeout(t);
  }, [isPending]);

  const slug = searchParams.get("slug");

  return (
    <Container maxWidth="sm" sx={{ py: 6, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        {!done ? (
          <CircularProgress size={56} sx={{ mb: 2 }} />
        ) : isPending ? (
          <ScheduleIcon sx={{ fontSize: 56, color: "warning.main", mb: 2 }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
        )}
        <Typography variant="h6" color="text.primary" gutterBottom>
          {message}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isPending
            ? "Te avisaremos cuando el pago se acredite."
            : "El pedido se actualizará en el mostrador en unos segundos."}
        </Typography>
        {done && (
          <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1 }}>
            {slug && (
              <Typography
                component="button"
                variant="body2"
                onClick={() => navigate(`/${slug}/menu`)}
                sx={{ cursor: "pointer", color: "primary.main", textDecoration: "underline", border: "none", background: "none" }}
              >
                Volver al menú
              </Typography>
            )}
            <Typography
              component="button"
              variant="body2"
              onClick={() => navigate("/")}
              sx={{ cursor: "pointer", color: "primary.main", textDecoration: "underline", border: "none", background: "none" }}
            >
              Volver al inicio
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}
