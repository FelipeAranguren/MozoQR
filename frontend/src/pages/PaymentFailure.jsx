// Página de retorno de Mercado Pago cuando el pago falló o fue rechazado (back_urls.failure).
// auto_return: 'approved' redirige a /payment-success; si el usuario cancela o falla, MP redirige aquí.
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import StatusPage from "../components/ui/StatusPage";

const REASON_HINTS = {
  config_error: "No pudimos validar el pago con el restaurante (credenciales o conexión). Si Mercado Pago mostró el cobro como aprobado, avisá en el local.",
  no_order_ref: "No se pudo asociar el cobro al pedido. Si ya te descontaron, pedí ayuda en el mostrador.",
  order_not_found: "No encontramos el pedido en el sistema. Si ya pagaste, conservá el comprobante de MP y avisá en el local.",
  error: "Hubo un error al confirmar el pago. Si MP mostró aprobado, puede ser solo sincronización: probá volver al menú desde el QR.",
};

export default function PaymentFailure() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("slug");
  const reason = searchParams.get("reason") || "";
  const reasonHint = REASON_HINTS[reason] || null;

  return (
    <StatusPage
      kicker="Mercado Pago"
      icon={<ErrorOutlineIcon sx={{ fontSize: 72, color: "error.main" }} />}
      title="El pago no pudo completarse"
      description="Podés intentar de nuevo o elegir otro método de pago."
      detail={reasonHint}
      primaryAction={slug ? { label: "Volver al menú", onClick: () => navigate(`/${slug}/menu`) } : null}
      secondaryAction={{ label: "Volver al inicio", onClick: () => navigate("/") }}
    />
  );
}
