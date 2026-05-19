import axios from 'axios';

/**
 * Strapi expone el REST bajo /api. En producción es fácil poner solo el host (Railway)
 * sin /api: el navegador pega contra el origen equivocado (p. ej. Vercel) y verás 404/405 en caja.
 */
function normalizeStrapiApiBase(raw) {
    const fallback = 'http://localhost:1337/api';
    if (raw == null || String(raw).trim() === '') return fallback;
    const s = String(raw).trim();
    if (s.startsWith('/')) return s.replace(/\/+$/, '') || '/api';
    try {
        const u = new URL(s);
        let path = u.pathname.replace(/\/+$/, '');
        if (path === '' || path === '/') {
            u.pathname = '/api';
        }
        return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
    } catch {
        return fallback;
    }
}

export const API_URL = normalizeStrapiApiBase(
    import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL,
);

export const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add JWT token if available
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Helper to unwrap Strapi response
export function unwrap(res) {
    return res?.data?.data ?? res?.data;
}
