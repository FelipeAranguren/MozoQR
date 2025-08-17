import React, { useEffect } from "react";
import { useCart } from "../context/CartContext";

export default function PagoSuccess() {
  const { clearCart } = useCart();

  useEffect(() => {
    // limpiamos el carrito al volver aprobado
    clearCart();
  }, [clearCart]);

  // (opcional) leer datos que devuelve MP:
  // const params = new URLSearchParams(location.search);
  // const paymentId = params.get("payment_id");

  return <h2>¡Pago aprobado! 🎉 Gracias por tu compra.</h2>;
}
