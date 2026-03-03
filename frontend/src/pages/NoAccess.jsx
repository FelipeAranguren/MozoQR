import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NoAccess() {
  const location = useLocation();
  const errorMessage = location.state?.error || null;

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "15vh",
        fontFamily: "sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⛔</div>
      <h2 style={{ color: "#b00", marginBottom: "1rem" }}>No tienes acceso a esta URL</h2>
      {errorMessage ? (
        <p style={{ color: "#666", marginBottom: "1.5rem", maxWidth: "600px", margin: "0 auto 1.5rem" }}>
          {errorMessage}
        </p>
      ) : (
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Verifica tu cuenta o los permisos del restaurante.
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <Link 
          to="/login" 
          style={{ 
            color: "#007bff", 
            textDecoration: "none",
            padding: "0.5rem 1rem",
            border: "1px solid #007bff",
            borderRadius: "4px",
            display: "inline-block"
          }}
        >
          Iniciar sesión
        </Link>
        <Link 
          to="/" 
          style={{ 
            color: "#007bff", 
            textDecoration: "none",
            padding: "0.5rem 1rem",
            border: "1px solid #007bff",
            borderRadius: "4px",
            display: "inline-block"
          }}
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
