//frontend/src/pages/PagoFailure.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { loadLastReceiptFromStorage } from "../utils/receipt";
import StatusPage from "../components/ui/StatusPage";

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
  const status = searchParams.get("status");
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
      variant="error"
      kicker="Pago"
      icon={<ErrorOutlineIcon sx={{ fontSize: 56, color: '#dc2626' }} />}
      title="El pago fue rechazado"
      description="No se pudo completar el cobro. Puedes intentar nuevamente o resolverlo en el mostrador."
      primaryAction={slug ? { label: "Volver al menú", onClick: () => navigate(`/${slug}/menu`) } : null}
      secondaryAction={{ label: "Volver al inicio", onClick: () => navigate("/"), variant: slug ? "outlined" : "contained" }}
    >
      {orderId ? (
        <Typography variant="body2" sx={{ color: '#52525b' }}>
          Pedido: {orderId}
        </Typography>
      ) : null}
    </StatusPage>
  );
}
