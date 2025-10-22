import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";

export default function GoogleRedirect() {
  const { login } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const access_token = params.get("access_token");
        if (!access_token) {
          window.location.replace("/login?error=missing_token");
          return;
        }

        const res = await fetch(`${STRAPI_URL}/auth/google/callback?access_token=${access_token}`, {
          method: "GET",
          credentials: "include",
        });

        // A veces Strapi devuelve JSON, a veces texto con error -> robusto:
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = null; }

        if (!res.ok || !data?.jwt || !data?.user) {
          console.error("Callback Google inválido:", raw);
          window.location.replace("/login?error=social");
          return;
        }

        // 🧹 limpiar token previo y guardar el nuevo SÍ o SÍ
        localStorage.removeItem("jwt");
        localStorage.setItem("jwt", data.jwt);

        // alias opcional
        const alias =
          data.user.displayName ||
          [data.user.firstname, data.user.lastname].filter(Boolean).join(" ") ||
          data.user.username ||
          (data.user.email ? data.user.email.split("@")[0] : "");

        // mantener tu estado global si lo usás
        try {
          login?.({ jwt: data.jwt, user: { ...data.user, alias } });
        } catch {}

        // a dónde quieras llevarlo después del login
        window.location.replace("/");
      } catch (e) {
        console.error(e);
        window.location.replace("/login?error=social");
      }
    })();
  }, [login]);

  return <p>Conectando con Google…</p>;
}
