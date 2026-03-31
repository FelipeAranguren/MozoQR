//frontend/src/pages/PagoPending.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Typography } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { loadLastReceiptFromStorage } from "../utils/receipt";
import StatusPage from "../components/ui/StatusPage";

function normalizeSlug(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const noQuery = raw.split("?")[0].split("#")[0];
  return noQuery.replace(/^\/+|\/+$/g, "");
}

export default function PagoPending() {
  const navigate = useNavigate();
  const { slug: slugFromRoute } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
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
    <StatusPage
      kicker="Pago"
      icon={<ScheduleIcon sx={{ fontSize: 72, color: "warning.main" }} />}
      title="Pago pendiente"
      description="Tu pago está siendo procesado. Podés consultar el estado en el mostrador mientras termina la acreditación."
      primaryAction={slug ? { label: "Volver al menú", onClick: () => navigate(`/${slug}/menu`) } : null}
      secondaryAction={{ label: "Volver al inicio", onClick: () => navigate("/"), variant: slug ? "outlined" : "contained" }}
    >
      {orderId ? (
        <Typography variant="body2" color="text.secondary">
          Pedido: {orderId}
        </Typography>
      ) : null}
    </StatusPage>
  );
}
