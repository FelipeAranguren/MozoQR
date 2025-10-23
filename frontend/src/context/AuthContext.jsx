import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [jwt, setJwt] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const j = localStorage.getItem("strapi_jwt");
    const u = localStorage.getItem("strapi_user");
    if (j && u) {
      setJwt(j);
      try { setUser(JSON.parse(u)); } catch { setUser(null); }
    }
  }, []);

  const login = ({ jwt, user }) => {
    localStorage.setItem("strapi_jwt", jwt);
    localStorage.setItem("strapi_user", JSON.stringify(user));
    setJwt(jwt);
    setUser(user);
  };

  const logout = () => {
  localStorage.removeItem("strapi_jwt");
  localStorage.removeItem("strapi_user");
  localStorage.removeItem("jwt");            // 👈 clave legacy
  setJwt(null);
  setUser(null);
  window.location.assign("/");               // o navigate("/", { replace: true })
};

  const isAuthenticated = !!jwt;

  return (
    <AuthContext.Provider value={{ jwt, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
