// frontend/src/guards/AuthGuard.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

function readToken() {
  return localStorage.getItem("strapi_jwt") || localStorage.getItem("jwt") || null;
}

export default function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const token = readToken();
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return <p>Verificando acceso...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/no-access" replace />;
  }

  return children;
}

