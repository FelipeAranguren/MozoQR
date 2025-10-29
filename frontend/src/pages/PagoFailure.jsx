//frontend/src/pages/PagoFailure.jsx
import React, { useMemo } from "react";

export default function PagoFailure() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = params.get("orderId");
  const status  = params.get("status"); // failure/rejected

  return (
    <div style={{ padding: 24 }}>
      <h2>El pago fue rechazado o falló.</h2>
      <p><strong>Pedido:</strong> {orderId || '-'}</p>
      <p><strong>Estado:</strong> {status || 'failure'}</p>
      <p>Intentá de nuevo.</p>
    </div>
  );
}
