import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";

export default function GoogleRedirect() {
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access_token = params.get("access_token");

    if (!access_token) {
      window.location.replace("/login?error=missing_token");
      return;
    }

    fetch(`${STRAPI_URL}/auth/google/callback?access_token=${access_token}`, {
      method: "GET",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        // ✅ AHORA SÍ: 'data' existe acá
        console.log("Login Google -> respuesta Strapi:", data);

        if (!data?.jwt || !data?.user) throw new Error("Respuesta inválida");

        // Intentamos obtener el “alias” / nombre visible de Google
        const alias =
          data.user.displayName ||
          [data.user.firstname, data.user.lastname].filter(Boolean).join(" ") ||
          data.user.username ||
          (data.user.email ? data.user.email.split("@")[0] : "");

        // Guardamos sesión con el alias adjunto
        login({ jwt: data.jwt, user: { ...data.user, alias } });

        window.location.replace("/");
      })
      .catch((e) => {
        console.error(e);
        window.location.replace("/login?error=social");
      });
  }, [login]);

  return <p>Conectando con Google…</p>;
}
