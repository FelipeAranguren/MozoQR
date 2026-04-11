// frontend/src/guards/AuthGuard.jsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

function readToken() {
  return localStorage.getItem("strapi_jwt") || localStorage.getItem("jwt") || null;
}

export default function AuthGuard({ children }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const token = readToken();
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return <p>Verificando acceso...</p>;
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/no-access" replace state={{ from }} />;
  }

  return children;
}

