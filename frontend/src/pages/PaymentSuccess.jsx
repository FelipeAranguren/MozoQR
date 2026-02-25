// Página de retorno de Mercado Pago cuando el pago fue aprobado (auto_return).
// Muestra "Procesando tu pedido..." mientras el webhook termina de actualizar la orden en segundo plano.
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Container, CircularProgress, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Procesando tu pedido…");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setMessage("¡Listo! Tu pago fue acreditado.");
      setDone(true);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const slug = searchParams.get("slug");

  return (
    <Container maxWidth="sm" sx={{ py: 6, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        {!done ? (
          <CircularProgress size={56} sx={{ mb: 2 }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
        )}
        <Typography variant="h6" color="text.primary" gutterBottom>
          {message}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          El pedido se actualizará en el mostrador en unos segundos.
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
