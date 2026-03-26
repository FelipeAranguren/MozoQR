// frontend/src/guards/OwnerRouteGuard.jsx
import { useEffect, useRef, useState } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { DemoAccessProvider } from "../context/DemoAccessContext";

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
  const location = useLocation();
  const [allowed, setAllowed] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const [error, setError] = useState(null);
  const [isDemoAccess, setIsDemoAccess] = useState(false);
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

    if (!slug) {
      console.warn('[OwnerRouteGuard] No slug found');
      setAllowed(false);
      setError('No se especificó el restaurante.');
      setIsDemoAccess(false);
      return;
    }

    setAllowed(null); // mostrando "Verificando acceso..."
    setError(null);
    setIsDemoAccess(false);
    
    (async () => {
      try {
        const baseUrl = getBaseUrl();

        // 1) Verificar si el restaurante es demo (is_demo === true)
        try {
          const demoRes = await fetch(
            `${baseUrl}/api/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&fields[0]=id&fields[1]=slug&fields[2]=is_demo`
          );
          const demoJson = await demoRes.json().catch(() => ({}));
          const restaurant = demoJson?.data?.[0];
          const attrs = restaurant?.attributes || restaurant || {};
          const isDemo = attrs?.is_demo === true;

          if (!cancelled && isDemo) {
            console.info('[OwnerRouteGuard] Demo restaurant detected, allowing public access for slug:', slug);
            setIsDemoAccess(true);
            setAllowed(true);
            setError(null);
            return; // No seguir con validación de token / roles
          }
        } catch (demoErr) {
          console.warn('[OwnerRouteGuard] Error checking is_demo, falling back to auth guard:', demoErr);
        }

        // 2) Si no es demo, requerir autenticación como antes
        if (!token) {
          if (!cancelled) {
            console.warn('[OwnerRouteGuard] No token found (non-demo restaurant)');
            setAllowed(false);
            setError('No hay token de autenticación. Por favor, inicia sesión.');
          }
          return;
        }

        const url = `${baseUrl}/api/owner/${slug}/authz-check`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        
        await res.json().catch(() => ({}));
        
        if (!cancelled) {
          if (res.ok) {
            setAllowed(true);
            setError(null);
            setIsDemoAccess(false);
          } else {
            setAllowed(false);
            setIsDemoAccess(false);
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
          setIsDemoAccess(false);
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
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/no-access" replace state={{ error, from }} />;
  }
  
  if (isDemoAccess) {
    return (
      <DemoAccessProvider isDemoAccess>
        {children}
      </DemoAccessProvider>
    );
  }

  return children;
}
