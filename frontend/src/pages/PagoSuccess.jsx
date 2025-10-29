//frontend/src/pages/PagoSuccess.jsx
import React, { useEffect, useMemo } from "react";
import { useCart } from "../context/CartContext";

export default function PagoSuccess() {
  const { clearCart } = useCart();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const paymentId   = params.get("payment_id");
  const status      = params.get("status");           // approved
  const merchantOrd = params.get("merchant_order_id");
  const prefId      = params.get("preference_id");
  const orderId     = params.get("orderId");          // lo mandamos en back_urls

  useEffect(() => {
    clearCart(); // limpiamos el carrito al volver aprobado
  }, [clearCart]);

  return (
    <div style={{ padding: 24 }}>
      <h2>¡Pago aprobado! 🎉 Gracias por tu compra.</h2>
      <p><strong>Pedido:</strong> {orderId || '-'}</p>
      <p><strong>Payment ID:</strong> {paymentId || '-'}</p>
      <p><strong>Estado:</strong> {status || '-'}</p>
      <p><strong>Preference:</strong> {prefId || '-'}</p>
      <p><strong>Merchant Order:</strong> {merchantOrd || '-'}</p>
    </div>
  );
}
