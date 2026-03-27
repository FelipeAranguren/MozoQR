//frontend/src/pages/PagoFailure.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { loadLastReceiptFromStorage } from "../utils/receipt";

function normalizeSlug(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const noQuery = raw.split("?")[0].split("#")[0];
  return noQuery.replace(/^\/+|\/+$/g, "");
}

export default function PagoFailure() {
  const navigate = useNavigate();
  const { slug: slugFromRoute } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status"); // failure/rejected
  const [slugFromReceipt, setSlugFromReceipt] = useState(null);

  useEffect(() => {
    const saved = loadLastReceiptFromStorage();
    if (saved?.slug) setSlugFromReceipt(saved.slug);
  }, []);

  const slug =
    normalizeSlug(slugFromRoute) ||
    normalizeSlug(searchParams.get("slug")) ||
    normalizeSlug(slugFromReceipt);

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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
          {slug && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => navigate(`/${slug}/menu`)}
              sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem", fontWeight: 600 }}
            >
              Volver al Menú
            </Button>
          )}
          <Button
            variant={slug ? "outlined" : "contained"}
            size="large"
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
