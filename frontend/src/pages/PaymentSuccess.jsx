// Página de retorno de Mercado Pago cuando el pago fue aprobado (auto_return: 'approved').
// back_urls.success apunta aquí. MP envía por query: payment_id, status, preference_id, external_reference, etc.
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Container, CircularProgress, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { LAST_RECEIPT_KEY } from "../utils/receipt";

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

  const normalizeSlug = (value) => {
    if (value == null) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const noQuery = raw.split("?")[0].split("#")[0];
    return noQuery.replace(/^\/+|\/+$/g, "");
  };

  const getReturnSlug = () => {
    const fromQuery = normalizeSlug(searchParams.get("slug"));
    if (fromQuery) return fromQuery;
    try {
      const saved = localStorage.getItem(LAST_RECEIPT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const fromStorage = normalizeSlug(parsed?.slug);
        if (fromStorage) return fromStorage;
      }
    } catch {
      // noop
    }
    return "";
  };

  const slug = getReturnSlug();
  // MP también puede enviar payment_id, collection_id, preference_id, external_reference por query

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
                onClick={() => navigate(`/${encodeURIComponent(slug)}/menu`, { replace: true })}
                sx={{ cursor: "pointer", color: "primary.main", textDecoration: "underline", border: "none", background: "none" }}
              >
                Volver al menú
              </Typography>
            )}
            <Typography
              component="button"
              variant="body2"
              onClick={() => navigate(slug ? `/${encodeURIComponent(slug)}/menu` : "/", { replace: true })}
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
