//frontend/src/pages/PagoFailure.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { loadLastReceiptFromStorage } from "../utils/receipt";

export default function PagoFailure() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = params.get("orderId");
  const status = params.get("status"); // failure/rejected
  const [slugFromReceipt, setSlugFromReceipt] = useState(null);

  useEffect(() => {
    const saved = loadLastReceiptFromStorage();
    if (saved?.slug) setSlugFromReceipt(saved.slug);
  }, []);

  const slug = slugFromReceipt || params.get("slug");

  return (
    <Container maxWidth="sm" sx={{ py: 4, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <ErrorOutlineIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          El pago fue rechazado
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          No se pudo completar el pago. Podés intentar de nuevo o pagar en el mostrador.
        </Typography>
        {orderId && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pedido: {orderId}
          </Typography>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {slug && (
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(`/${slug}/menu`)}
              sx={{ borderRadius: 2, py: 1.5 }}
            >
              Volver al menú e intentar de nuevo
            </Button>
          )}
          <Button
            variant={slug ? "outlined" : "contained"}
            fullWidth
            onClick={() => navigate("/")}
            sx={{ borderRadius: 2, py: 1.5 }}
          >
            Volver al inicio
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
