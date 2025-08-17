import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [jwt, setJwt] = useState(null);
  const [user, setUser] = useState(null);

  // cargar sesión desde localStorage al entrar
  useEffect(() => {
    const j = localStorage.getItem("strapi_jwt");
    const u = localStorage.getItem("strapi_user");
    if (j && u) {
      setJwt(j);
      try {
        setUser(JSON.parse(u));
      } catch {
        setUser(null);
      }
    }
  }, []);

  // helpers públicos
  const login = ({ jwt, user }) => {
    localStorage.setItem("strapi_jwt", jwt);
    localStorage.setItem("strapi_user", JSON.stringify(user));
    setJwt(jwt);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("strapi_jwt");
    localStorage.removeItem("strapi_user");
    setJwt(null);
    setUser(null);
    // redirigí si querés:
    // window.location.replace("/login");
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
