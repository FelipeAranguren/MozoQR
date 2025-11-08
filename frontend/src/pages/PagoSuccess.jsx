//frontend/src/pages/PagoSuccess.jsx
import React, { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";

const STRAPI = import.meta.env.VITE_STRAPI_URL || "http://127.0.0.1:1337";

export default function PagoSuccess() {
  const { clearCart } = useCart();
  const [msg, setMsg] = useState("Confirmando pago…");

  useEffect(() => {
    clearCart();
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const preference_id = q.get("preference_id");
        const payment_id    = q.get("payment_id"); // puede venir si usás auto_return
        const url = new URL(`${STRAPI}/api/payments/confirm`);
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

  return <h2>{msg}</h2>;
}
