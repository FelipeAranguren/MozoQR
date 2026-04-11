//frontend/src/pages/PagoSuccess.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { Button, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReceiptIcon from "@mui/icons-material/Receipt";
import { loadLastReceiptFromStorage, LAST_RECEIPT_KEY } from "../utils/receipt";
import ReceiptDialog from "../components/ReceiptDialog";
import StatusPage from "../components/ui/StatusPage";

const API_BASE = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api").replace(/\/api\/?$/, "");

export default function PagoSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { slug: slugFromRoute } = useParams();
  const { clearCart } = useCart();
  const [msg, setMsg] = useState("Confirmando pago…");
  const [receiptData, setReceiptData] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const normalizeSlug = (value) => {
    if (value == null) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const noQuery = raw.split("?")[0].split("#")[0];
    return noQuery.replace(/^\/+|\/+$/g, "");
  };

  const getReturnSlug = () => {
    const fromPath = normalizeSlug(slugFromRoute);
    if (fromPath) return fromPath;
    const fromQuery = normalizeSlug(searchParams.get("slug"));
    if (fromQuery) return fromQuery;
    const fromReceipt = normalizeSlug(receiptData?.slug);
    if (fromReceipt) return fromReceipt;
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

  useEffect(() => {
    const saved = loadLastReceiptFromStorage();
    if (saved && (saved?.items?.length > 0 || saved?.total != null || saved?.mesaNumber != null))
      setReceiptData(saved);
  }, []);

  const slug = getReturnSlug();

  useEffect(() => {
    clearCart();
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const preference_id = q.get("preference_id");
        const payment_id    = q.get("payment_id");
        const url = new URL(`${API_BASE}/api/payments/confirm`);
        if (preference_id) url.searchParams.set("preference_id", preference_id);
        if (payment_id)    url.searchParams.set("payment_id", payment_id);
        url.searchParams.set("format", "json");
        const res = await fetch(url.toString(), { redirect: "manual" });
        const data = await res.json().catch(() => ({}));
        if (res.status >= 300 && res.status < 400) {
          throw new Error("El servidor respondió con redirección; probá de nuevo o avisá en mostrador.");
        }
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

  const handleSeguirOrdenando = () => {
    const target = slug ? `/${encodeURIComponent(slug)}/menu` : "/";
    navigate(target, { replace: true });
    window.setTimeout(() => {
      window.location.assign(target);
    }, 250);
  };

  const handleVolverInicio = () => {
    const target = slug ? `/${encodeURIComponent(slug)}/menu` : "/";
    navigate(target, { replace: true });
    window.setTimeout(() => {
      window.location.assign(target);
    }, 250);
  };

  return (
    <StatusPage
      variant="success"
      kicker="Pago"
      icon={<CheckCircleIcon sx={{ fontSize: 56, color: '#16a34a' }} />}
      title="Pago confirmado"
      description={msg}
      primaryAction={slug ? { label: "Seguir ordenando", onClick: handleSeguirOrdenando } : null}
      secondaryAction={{ label: "Volver al inicio", onClick: handleVolverInicio, variant: slug ? "outlined" : "contained" }}
    >
      {receiptData ? (
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<ReceiptIcon />}
          onClick={handleShowReceipt}
          sx={{
            mt: 1,
            mb: 1,
            maxWidth: 380,
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            py: 1.25,
            bgcolor: '#16a34a',
            '&:hover': { bgcolor: '#16a34a', filter: 'brightness(0.9)' },
          }}
        >
          Ver / Imprimir recibo
        </Button>
      ) : (
        <Typography variant="body2" sx={{ color: '#52525b' }}>
          Estamos cerrando el pago y sincronizando el pedido con el sistema.
        </Typography>
      )}
      <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} receiptData={receiptData} />
    </StatusPage>
  );
}
