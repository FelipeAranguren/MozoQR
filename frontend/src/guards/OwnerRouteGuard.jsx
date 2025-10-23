// frontend/src/guards/OwnerRouteGuard.jsx
import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

const API_URL = "http://localhost:1337";

function readToken() {
  return localStorage.getItem("strapi_jwt") || localStorage.getItem("jwt") || null;
}

export default function OwnerRouteGuard({ children }) {
  const { slug } = useParams();
  const [allowed, setAllowed] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const lastTokenRef = useRef(token);

  // watcher del token (misma pestaña + focus/tab)
  useEffect(() => {
    const check = () => {
      const t = readToken();
      if (t !== lastTokenRef.current) {
        lastTokenRef.current = t;
        setToken(t);
      }
    };
    const id = setInterval(check, 700);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setAllowed(false);
      return;
    }

    setAllowed(null); // mostrando "Verificando acceso..."
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/owner/${slug}/authz-check`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setAllowed(res.ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  if (allowed === null) return <p>Verificando acceso...</p>;
  if (!allowed) return <Navigate to="/no-access" replace />;
  return children;
}
