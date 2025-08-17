import React, { useState } from "react";
import { Button } from "@mui/material";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";

/**
 * Props:
 * - items: [{ title: string, unit_price: number, quantity: number }]
 * - orderId: string | number (opcional, para identificar tu pedido)
 */
export default function PayWithMercadoPago({ items, orderId }) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${STRAPI_URL}/payments/create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, orderId }),
      });
      const data = await res.json();
      if (!data?.init_point) throw new Error("No init_point en respuesta");
      window.location.href = data.init_point; // redirige a Checkout Pro
    } catch (e) {
      console.error(e);
      alert("No pudimos iniciar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      onClick={handlePay}
      disabled={loading}
      sx={{ textTransform: "none" }}
    >
      {loading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
    </Button>
  );
}
