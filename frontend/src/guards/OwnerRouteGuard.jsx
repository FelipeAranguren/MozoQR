// frontend/src/guards/OwnerRouteGuard.jsx
import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

// Misma base que el resto de la app para que el JWT sea válido en el mismo backend
function getBaseUrl() {
  const u = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || 'http://localhost:1337/api';
  const base = (u || '').replace(/\/api\/?$/, '') || 'http://localhost:1337';
  return base;
}

function readToken() {
  return localStorage.getItem("strapi_jwt") || localStorage.getItem("jwt") || null;
}

export default function OwnerRouteGuard({ children }) {
  const { slug } = useParams();
  const [allowed, setAllowed] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const [error, setError] = useState(null);
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
      console.warn('[OwnerRouteGuard] No token found');
      setAllowed(false);
      setError('No hay token de autenticación. Por favor, inicia sesión.');
      return;
    }

    if (!slug) {
      console.warn('[OwnerRouteGuard] No slug found');
      setAllowed(false);
      setError('No se especificó el restaurante.');
      return;
    }

    setAllowed(null); // mostrando "Verificando acceso..."
    setError(null);
    
    (async () => {
      try {
        const baseUrl = getBaseUrl();
        const url = `${baseUrl}/api/owner/${slug}/authz-check`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        
        const data = await res.json().catch(() => ({}));
        
        if (!cancelled) {
          if (res.ok) {
            setAllowed(true);
            setError(null);
          } else {
            setAllowed(false);
            // Proporcionar mensaje de error más descriptivo
            if (res.status === 401) {
              setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            } else if (res.status === 403) {
              setError(`No tienes permisos para acceder al restaurante "${slug}". Verifica que seas owner o staff de este restaurante.`);
            } else {
              setError(`Error al verificar acceso (${res.status}). Por favor, intenta nuevamente.`);
            }
          }
        }
      } catch (err) {
        console.error('[OwnerRouteGuard] Error:', err);
        if (!cancelled) {
          setAllowed(false);
          setError(`Error de conexión: ${err.message}. Verifica que el servidor esté funcionando.`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  if (allowed === null) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Verificando acceso...</p>
      </div>
    );
  }
  
  if (!allowed) {
    return <Navigate to="/no-access" replace state={{ error }} />;
  }
  
  return children;
}
