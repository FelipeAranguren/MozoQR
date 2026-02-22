//frontend/src/components/PayWithMercadoPago.jsx
import React, { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { createMpPreference } from "../api/payments";

/**
 * Props:
 * - orderId: string | number (recomendado para reconciliar pagos)
 * - amount?: number (opcional si no mandás items; si falta orderId se usa amount)
 * - items?: [{ title: string, unit_price: number, quantity: number, currency_id?: 'ARS' }]
 * - payerEmail?: string
 * - backUrls?: { success, pending, failure }
 * - slug?: string (incluido en URLs de retorno de MP para "Volver al menú")
 * - onBeforePay?: () => void | Promise<void> - llamado antes de redirigir a MP (ej: guardar recibo)
 * - label?: string
 * - variant?: MUI Button variant
 * - fullWidth?: boolean
 * - disabled?: boolean
 */
export default function PayWithMercadoPago({
  orderId,
  amount,
  items,
  payerEmail,
  backUrls,
  slug,
  onBeforePay,
  label = "Pagar con Mercado Pago",
  variant = "contained",
  fullWidth = true,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  const hasOrderId = orderId != null && orderId !== '';
  const hasAmount = amount != null && Number(amount) > 0;
  const hasItems = Array.isArray(items) && items.length > 0;
  const canPay = hasOrderId || hasAmount || hasItems;
  const isDisabled = disabled || loading || !canPay;

  async function handlePay() {
    if (!canPay) {
      alert("Falta orderId o monto para iniciar el pago.");
      return;
    }

    setLoading(true);
    try {
      if (onBeforePay) await Promise.resolve(onBeforePay());
      const data = await createMpPreference({
        orderId,
        amount,
        items,
        payer_email: payerEmail,
        back_urls: backUrls,
        slug,
      });

      if (!data || data.ok !== true) {
        alert(data?.error || "No se pudo preparar el pago. Intentá de nuevo.");
        return;
      }
      const url = data.sandbox_init_point || data.init_point;
      if (!url || typeof url !== "string") {
        alert("No se recibió el enlace de pago. Intentá de nuevo.");
        return;
      }
      window.location.href = url; // redirige a Checkout Pro
    } catch (err) {
      console.error("PayWithMercadoPago error:", err);
      const msg =
        (err && typeof err.message === "string" && err.message) ||
        "No pudimos iniciar el pago. Revisá tu conexión e intentá de nuevo.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handlePay}
      disabled={isDisabled}
      fullWidth={fullWidth}
      variant={variant}
      sx={{ textTransform: "none" }}
      aria-label={label}
    >
      {loading ? <CircularProgress size={22} /> : label}
    </Button>
  );
}
