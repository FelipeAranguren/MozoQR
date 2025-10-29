//frontend/src/pages/PagoPending.jsx
import React, { useMemo } from "react";

export default function PagoPending() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = params.get("orderId");
  const status  = params.get("status"); // pending

  return (
    <div style={{ padding: 24 }}>
      <h2>Tu pago quedó pendiente.</h2>
      <p><strong>Pedido:</strong> {orderId || '-'}</p>
      <p><strong>Estado:</strong> {status || 'pending'}</p>
      <p>Te avisaremos cuando se acredite.</p>
    </div>
  );
}
