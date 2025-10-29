//frontend/src/components/PayWithMercadoPago.jsx
import React, { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { createMpPreference } from "../api/payments";

/**
 * Props:
 * - orderId: string | number (recomendado para reconciliar pagos)
 * - amount?: number (opcional si no mandás items)
 * - items?: [{ title: string, unit_price: number, quantity: number, currency_id?: 'ARS' }]
 * - payerEmail?: string
 * - backUrls?: { success, pending, failure }
 * - label?: string
 * - variant?: MUI Button variant
 * - fullWidth?: boolean
 */
export default function PayWithMercadoPago({
  orderId,
  amount,
  items,
  payerEmail,
  backUrls,
  label = "Pagar con Mercado Pago",
  variant = "contained",
  fullWidth = true,
}) {
  const [loading, setLoading] = useState(false);



  async function handlePay() {
    try {
      if (!orderId) {
        alert("Falta orderId para iniciar el pago.");
        return;
      }

      setLoading(true);
      const data = await createMpPreference({
        orderId,
        amount,
        items,
        payer_email: payerEmail,
        back_urls: backUrls,
      });

      
      const url = data?.sandbox_init_point || data?.init_point;
      if (!url) throw new Error("No se recibió init_point de Mercado Pago.");

      window.location.href = url; // redirige a Checkout Pro
    } catch (err) {
      console.error("PayWithMercadoPago error:", err);
      alert(err.message || "No pudimos iniciar el pago.");
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading} fullWidth={fullWidth} variant={variant} sx={{ textTransform: "none" }}>
      {loading ? <CircularProgress size={22} /> : label}
    </Button>
  );
}
