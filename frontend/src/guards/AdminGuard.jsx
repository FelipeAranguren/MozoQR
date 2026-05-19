import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchAdminAuthCheck } from "../api/admin";

const PLATFORM_ADMIN_EMAILS = (
  import.meta.env.VITE_PLATFORM_ADMIN_EMAILS || "marioealfonzo@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isPlatformAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return e && PLATFORM_ADMIN_EMAILS.includes(e);
}

function readToken() {
  return localStorage.getItem("strapi_jwt") || localStorage.getItem("jwt") || null;
}

function readUserEmail() {
  try {
    const raw = localStorage.getItem("strapi_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return (user?.email || "").trim().toLowerCase();
  } catch {
    return null;
  }
}

export default function AdminGuard({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(null); // null = checking, 'ok' | 'denied'

  useEffect(() => {
    const token = readToken();
    if (!token) { setStatus("denied"); return; }

    fetchAdminAuthCheck()
      .then((data) => {
        if (data?.ok && data?.isPlatformAdmin !== false) setStatus("ok");
        else setStatus("denied");
      })
      .catch((err) => {
        const statusCode = err?.response?.status;
        const email = readUserEmail();
        // Fallback: backend sin /admin/auth-check (404) pero JWT válido de super admin
        if ((statusCode === 404 || statusCode === 405) && isPlatformAdminEmail(email)) {
          setStatus("ok");
          return;
        }
        setStatus("denied");
      });
  }, []);

  if (status === null) return <p>Verificando acceso...</p>;
  if (status === "denied") {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/no-access" replace state={{ from }} />;
  }

  return children;
}
