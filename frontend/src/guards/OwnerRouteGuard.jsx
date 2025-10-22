import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

// fija la URL del backend en dev para evitar que golpee al 5173 (Vite)
const API_URL = "http://localhost:1337";

export default function OwnerRouteGuard({ children }) {
  const [allowed, setAllowed] = useState(null); // null = loading
  const { slug } = useParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem("jwt");
      console.log("[guard] slug:", slug, "token?", !!token);
      if (!token) {
        if (!cancelled) setAllowed(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/owner/${slug}/authz-check`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text(); // para depurar
        console.log("[guard] status:", res.status, "body:", text);

        if (cancelled) return;
        if (res.ok) setAllowed(true);
        else setAllowed(false);
      } catch (e) {
        console.log("[guard] error:", e);
        if (!cancelled) setAllowed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (allowed === null) return <p>Verificando acceso...</p>;
  if (allowed === false) return <Navigate to="/no-access" replace />;
  return children;
}
