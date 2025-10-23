import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

// Claves únicas y consistentes
const LS_JWT_KEY = "strapi_jwt";
const LS_USER_KEY = "strapi_user";

export function AuthProvider({ children }) {
  const [jwt, setJwt] = useState(null);
  const [user, setUser] = useState(null);

  // Cargar sesión desde localStorage al entrar
  useEffect(() => {
    const j = localStorage.getItem(LS_JWT_KEY);
    const u = localStorage.getItem(LS_USER_KEY);
    if (j) setJwt(j);
    if (u) {
      try { setUser(JSON.parse(u)); } catch { setUser(null); }
    }
  }, []);

  // Sincronizar cambios de jwt entre pestañas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_JWT_KEY) {
        setJwt(e.newValue);
        if (!e.newValue) setUser(null);
      }
      if (e.key === LS_USER_KEY && e.newValue) {
        try { setUser(JSON.parse(e.newValue)); } catch { setUser(null); }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // helpers públicos
  const login = ({ jwt, user }) => {
    localStorage.setItem(LS_JWT_KEY, jwt);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(user || null));
    setJwt(jwt);
    setUser(user || null);
  };

  const logout = () => {
    localStorage.removeItem(LS_JWT_KEY);
    localStorage.removeItem(LS_USER_KEY);
    setJwt(null);
    setUser(null);
    // Limpia cookies (por si quedó algo del flujo social)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  };

  const isAuthenticated = Boolean(jwt);

  return (
    <AuthContext.Provider value={{ jwt, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
