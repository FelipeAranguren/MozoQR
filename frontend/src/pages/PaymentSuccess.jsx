import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { LAST_RECEIPT_KEY } from "../utils/receipt";
import StatusPage from "../components/ui/StatusPage";

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
  const goToTableSelector = () => {
    const target = slug ? `/${encodeURIComponent(slug)}/menu` : "/";
    navigate(target, { replace: true });
    window.setTimeout(() => {
      window.location.assign(target);
    }, 250);
  };

  return (
    <StatusPage
      variant={isPending ? "warning" : "success"}
      kicker="Mercado Pago"
      icon={
        !done ? (
          <CircularProgress size={48} sx={{ color: isPending ? '#d97706' : '#16a34a' }} />
        ) : isPending ? (
          <ScheduleIcon sx={{ fontSize: 56, color: '#d97706' }} />
        ) : (
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#16a34a' }} />
        )}
      title={isPending ? "Pago pendiente" : "Pago acreditado"}
      description={message}
      detail={
        isPending
          ? "Te avisaremos cuando el pago se acredite."
          : "El pedido se actualizará en el mostrador en unos segundos."
      }
      primaryAction={done && slug ? { label: "Volver al menú", onClick: goToTableSelector } : null}
      secondaryAction={done ? { label: "Volver al inicio", onClick: goToTableSelector, variant: slug ? "outlined" : "contained" } : null}
    >
      {!done ? <Box sx={{ height: 8 }} /> : null}
    </StatusPage>
  );
}
