//frontend/src/pages/PagoPending.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { loadLastReceiptFromStorage } from "../utils/receipt";

export default function PagoPending() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = params.get("orderId");
  const [slugFromReceipt, setSlugFromReceipt] = useState(null);

  useEffect(() => {
    const saved = loadLastReceiptFromStorage();
    if (saved?.slug) setSlugFromReceipt(saved.slug);
  }, []);

  const slug = slugFromReceipt || params.get("slug");

  return (
    <Container maxWidth="sm" sx={{ py: 4, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <ScheduleIcon sx={{ fontSize: 64, color: "warning.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          Pago pendiente
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Tu pago está siendo procesado. Te avisaremos cuando se acredite. Podés consultar el estado en el mostrador.
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
              Volver al menú
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
