/**
 * Origen público de Strapi (sin /api) para URLs de uploads y archivos.
 * Con VITE_API_URL=/api en dev, Vite hace proxy a Strapi; el origen es el del frontend.
 */
export function getStrapiPublicBase() {
  const u = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || 'http://localhost:1337/api';
  const s = String(u).trim();
  if (s.startsWith('http')) {
    return s.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:1337';
}
