import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

// En localhost usar siempre el backend local; en producción usar env
function getApiUrl() {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalhost) return "http://localhost:1337/api";
  const u = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api";
  const base = (u || "").replace(/\/api\/?$/, "") || "http://localhost:1337";
  return `${base}/api`;
}

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

        const API_URL = getApiUrl();
        let data = null;

        // 1) Algunas configuraciones de Strapi envían el JWT directamente como access_token
        const meRes = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
          credentials: "include",
        });
        if (meRes.ok) {
          const user = await meRes.json();
          data = { jwt: access_token, user };
        }

        // 2) Si no, canjear con el endpoint de callback del provider
        if (!data?.jwt || !data?.user) {
          const res = await fetch(`${API_URL}/auth/google/callback?access_token=${access_token}`, {
            method: "GET",
            credentials: "include",
          });
          const raw = await res.text();
          try {
            data = JSON.parse(raw);
          } catch {
            data = null;
          }
          if (!res.ok || !data?.jwt || !data?.user) {
            console.error("Callback Google inválido:", raw);
            window.location.replace("/login?error=social");
            return;
          }
        }

        // Limpiar tokens previos y guardar el nuevo
        localStorage.removeItem("jwt");
        localStorage.removeItem("strapi_jwt");
        localStorage.removeItem("strapi_user");
        localStorage.setItem("strapi_jwt", data.jwt);
        localStorage.setItem("jwt", data.jwt);

        const alias =
          data.user.displayName ||
          [data.user.firstname, data.user.lastname].filter(Boolean).join(" ") ||
          data.user.username ||
          (data.user.email ? data.user.email.split("@")[0] : "");
        const userWithAlias = { ...data.user, alias };
        localStorage.setItem("strapi_user", JSON.stringify(userWithAlias));

        try {
          login?.({ jwt: data.jwt, user: userWithAlias });
        } catch {}

        window.location.replace("/");
      } catch (e) {
        console.error(e);
        window.location.replace("/login?error=social");
      }
    })();
  }, [login]);

  return <p>Conectando con Google…</p>;
}
