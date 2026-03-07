/**
 * Centralized URL configuration
 * All URLs should come from environment variables or Strapi config
 */

/**
 * Ensures a URL is valid HTTP/HTTPS, adds protocol if missing
 */
export function ensureHttpUrl(url?: string | null, fallback?: string): string {
  const s = String(url || '').trim();
  if (!s) {
    if (fallback) return ensureHttpUrl(fallback);
    throw new Error('URL is required but not provided');
  }
  if (!/^https?:\/\//i.test(s)) {
    return `http://${s.replace(/^\/*/, '')}`;
  }
  return s;
}

/**
 * Get frontend URL from environment variables.
 * En producción (NODE_ENV=production) no usar localhost para back_urls de Mercado Pago.
 */
export function getFrontendUrl(): string {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
    '';
  if (raw && raw.trim().length > 0) return ensureHttpUrl(raw.trim());
  const isProd = process.env.NODE_ENV === 'production';
  return ensureHttpUrl(isProd ? 'https://mozoqr.vercel.app' : 'http://localhost:5173');
}

/**
 * Get backend URL from environment variables or Strapi config.
 * En producción definir BACKEND_URL, STRAPI_URL o PUBLIC_URL para back_urls de Mercado Pago.
 */
export function getBackendUrl(strapiConfig?: any): string {
  const envUrl = process.env.BACKEND_URL ||
                 process.env.STRAPI_URL ||
                 process.env.PUBLIC_URL;

  if (envUrl && String(envUrl).trim().length > 0) {
    return ensureHttpUrl(envUrl.trim());
  }

  if (strapiConfig) {
    const strapiUrl = strapiConfig.get?.('server.url');
    if (strapiUrl && String(strapiUrl).trim().length > 0) {
      return ensureHttpUrl(strapiUrl);
    }
  }

  return 'http://localhost:1337';
}

/**
 * Check if a URL is HTTPS
 */
export function isHttps(url?: string | null): boolean {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim());
}

