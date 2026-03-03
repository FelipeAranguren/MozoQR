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
 * Get frontend URL from environment variables
 */
export function getFrontendUrl(): string {
  return ensureHttpUrl(
    process.env.FRONTEND_URL || 
    process.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
    '',
    'http://localhost:5173' // Fallback solo para desarrollo
  );
}

/**
 * Get backend URL from environment variables or Strapi config
 */
export function getBackendUrl(strapiConfig?: any): string {
  // Try environment variables first
  const envUrl = process.env.BACKEND_URL || 
                 process.env.STRAPI_URL || 
                 process.env.PUBLIC_URL;
  
  if (envUrl) {
    return ensureHttpUrl(envUrl);
  }
  
  // Fallback to Strapi config if available
  if (strapiConfig) {
    const strapiUrl = strapiConfig.get?.('server.url');
    if (strapiUrl) {
      return ensureHttpUrl(strapiUrl);
    }
  }
  
  // Last resort: localhost for development
  return 'http://localhost:1337';
}

/**
 * Check if a URL is HTTPS
 */
export function isHttps(url?: string | null): boolean {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim());
}

