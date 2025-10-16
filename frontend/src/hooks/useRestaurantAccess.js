// frontend/src/hooks/useRestaurantAccess.js
import { useEffect, useState } from 'react';
import { api, withSlug } from '../api';

export function useRestaurantAccess(slug, user) {
  const [state, setState] = useState({
    status: 'idle',
    role: null,
    restaurantName: null,
    error: null,
  });

  useEffect(() => {
    if (!slug || !user) return;

    // ————— reemplazá tu bloque de "const token = ..." por esto —————
function sniffJWT() {
  // 1) de AuthContext
  if (user?.jwt)   return user.jwt;
  if (user?.token) return user.token;

  // 2) localStorage: keys comunes
  const common = ['jwt','token','authToken','strapi_jwt','access_token'];
  for (const k of common) {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
    if (v && v.length > 20) return v;
  }

  // 3) escaneo completo de localStorage (por si quedó con otro nombre)
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (v && /^eyJ[A-Za-z0-9-_]+\./.test(v)) return v; // parece JWT
      // a veces guardan objetos JSON con { jwt: "..." }
      try {
        const obj = JSON.parse(v);
        if (obj?.jwt && typeof obj.jwt === 'string') return obj.jwt;
        if (obj?.token && typeof obj.token === 'string') return obj.token;
      } catch {}
    }
  }

  // 4) cookies (por si lo guardan ahí)
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)(jwt|token|authToken|strapi_jwt)=([^;]+)/);
    if (m) return decodeURIComponent(m[2]);
  }
  return null;
}

const token = sniffJWT();
const headers = token
  ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  : { 'Content-Type': 'application/json' };
// ————— fin del reemplazo —————


     setState({ status: 'loading', role: null, restaurantName: null, error: null });

    api
      .get(withSlug(slug, '/membership'), { headers })
      .then((res) => {
        const node = res?.data?.data;
        if (!node) {
          setState({ status: 'forbidden', role: null, restaurantName: null, error: null });
          return;
        }
        const role = attrs?.role ?? null;
        const restaurantName = attrs?.restaurante?.data?.attributes?.name ?? null;
        setState({ status: 'allowed', role, restaurantName, error: null });
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401)
          setState({ status: 'unauthorized', role: null, restaurantName: null, error: null });
        else if (status === 403)
          setState({ status: 'forbidden', role: null, restaurantName: null, error: null });
        else
          setState({ status: 'error', role: null, restaurantName: null, error: err });
      });
  }, [slug, user]);

  return state;
}
