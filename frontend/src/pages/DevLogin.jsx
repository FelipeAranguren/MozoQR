// src/pages/DevLogin.jsx
import { useState } from "react";

const API_URL = "http://localhost:1337"; // fijo para dev


export default function DevLogin() {
  const [identifier, setIdentifier] = useState("owner@mcd.com");
  const [password, setPassword] = useState("Mcd!2345");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/local`, {
        method: "POST", // 👈 aseguramos POST
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      // Intentamos parsear JSON si es posible; si no, leemos texto
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text; // p.ej. "Method Not Allowed"
      }

      if (!res.ok) {
        const msg =
          typeof data === "string"
            ? data
            : data?.error?.message || "Error en login";
        throw new Error(msg);
      }

      // OK -> guardar token y redirigir
      localStorage.setItem("jwt", data.jwt);
      window.location.href = "/owner/mcdonalds/dashboard";
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "6rem auto", fontFamily: "sans-serif" }}>
      <h2>Login (DEV)</h2>
      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <button type="submit">Entrar</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <p style={{ marginTop: 12, opacity: 0.7 }}>
        Solo para local/dev. Quitar en producción.
      </p>
    </div>
  );
}
