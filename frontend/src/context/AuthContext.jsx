import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
// Los endpoints de auth están bajo /api
const API_URL = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || "http://localhost:1337/api";

export function AuthProvider({ children }) {
  const [jwt, setJwt] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const j = localStorage.getItem("strapi_jwt");
    const u = localStorage.getItem("strapi_user");
    if (j && u) {
      setJwt(j);
      try { setUser(JSON.parse(u)); } catch { setUser(null); }
    }
    setLoading(false);
  }, []);

  const login = ({ jwt, user }) => {
    localStorage.setItem("strapi_jwt", jwt);
    localStorage.setItem("strapi_user", JSON.stringify(user));
    localStorage.setItem("jwt", jwt); // legacy
    setJwt(jwt);
    setUser(user);
  };

  const loginWithEmail = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Error al iniciar sesión");
      }

      if (data.jwt && data.user) {
        login({ jwt: data.jwt, user: data.user });
        return { success: true };
      }

      throw new Error("Credenciales inválidas");
    } catch (error) {
      return { 
        success: false, 
        error: error.message || "Credenciales inválidas" 
      };
    }
  };

  const register = async (email, password, username) => {
    try {
      const response = await fetch(`${API_URL}/auth/local/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          username: username || email.split("@")[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Error al registrarse");
      }

      if (data.jwt && data.user) {
        login({ jwt: data.jwt, user: data.user });
        return { success: true };
      }

      throw new Error("Error al crear la cuenta");
    } catch (error) {
      return { 
        success: false, 
        error: error.message || "Error al registrarse" 
      };
    }
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
    <AuthContext.Provider value={{ 
      jwt, 
      user, 
      isAuthenticated, 
      loading,
      login, 
      loginWithEmail,
      register,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth must be used within an AuthProvider');
    return {
      jwt: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      login: () => {},
      loginWithEmail: async () => {},
      register: async () => {},
      logout: () => {}
    };
  }
  return context;
}
