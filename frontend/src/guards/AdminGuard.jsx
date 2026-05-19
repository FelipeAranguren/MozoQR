import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchAdminAuthCheck } from "../api/admin";

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
        if (data?.ok && data?.isPlatformAdmin) setStatus("ok");
        else setStatus("denied");
      })
      .catch(() => setStatus("denied"));
  }, []);

  if (status === null) return <p>Verificando acceso...</p>;
  if (status === "denied") {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/no-access" replace state={{ from }} />;
  }

  return children;
}
