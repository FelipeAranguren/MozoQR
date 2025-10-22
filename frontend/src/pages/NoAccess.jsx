import React from "react";
import { Link } from "react-router-dom";

export default function NoAccess() {
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "15vh",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ color: "#b00" }}>⛔ No tienes acceso a esta URL</h2>
      <p>Verifica tu cuenta o los permisos del restaurante.</p>
      <Link to="/" style={{ color: "#007bff", textDecoration: "none" }}>
        ← Volver al inicio
      </Link>
    </div>
  );
}
