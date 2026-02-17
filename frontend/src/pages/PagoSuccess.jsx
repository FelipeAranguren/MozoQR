//frontend/src/pages/PagoSuccess.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { Button, Container, Paper, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReceiptIcon from "@mui/icons-material/Receipt";
import { loadLastReceiptFromStorage } from "../utils/receipt";
import ReceiptDialog from "../components/ReceiptDialog";

const API_BASE = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api").replace(/\/api\/?$/, "");

export default function PagoSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [msg, setMsg] = useState("Confirmando pago…");
  const [receiptData, setReceiptData] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    const saved = loadLastReceiptFromStorage();
    if (saved && (saved?.items?.length > 0 || saved?.total != null || saved?.mesaNumber != null))
      setReceiptData(saved);
  }, []);

  const slug = receiptData?.slug || searchParams.get("slug");

  useEffect(() => {
    clearCart();
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const preference_id = q.get("preference_id");
        const payment_id    = q.get("payment_id"); // puede venir si usás auto_return
        const url = new URL(`${API_BASE}/api/payments/confirm`);
        if (preference_id) url.searchParams.set("preference_id", preference_id);
        if (payment_id)    url.searchParams.set("payment_id", payment_id);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo confirmar el pago");
        setMsg(`¡Pago confirmado! Pedido #${data.orderId} (${data.status}).`);
      } catch (e) {
        console.error(e);
        setMsg("Pago aprobado en MP, pero no pude confirmarlo en el sistema. Avisá en mostrador.");
      }
    })();
  }, [clearCart]);

  const handleShowReceipt = () => {
    if (receiptData) setReceiptOpen(true);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
        <Typography variant="h5" gutterBottom>{msg}</Typography>
        {receiptData && (
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<ReceiptIcon />}
            onClick={handleShowReceipt}
            sx={{ mt: 2, mb: 1, borderRadius: 2, py: 1.5, bgcolor: "success.main" }}
          >
            Ver / Imprimir recibo
          </Button>
        )}
        <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} receiptData={receiptData} />
        {slug && (
          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => navigate(`/${slug}/menu`)}
            sx={{ mt: 2, borderRadius: 2, py: 1.5 }}
          >
            Volver al menú
          </Button>
        )}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => navigate("/")}
          sx={{ mt: slug ? 1 : 2, borderRadius: 2, py: 1.5 }}
        >
          Volver al inicio
        </Button>
      </Paper>
    </Container>
  );
}
