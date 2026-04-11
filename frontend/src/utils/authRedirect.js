/** sessionStorage: destino post-login OAuth (Google) */
export const AUTH_RETURN_STORAGE_KEY = 'mozoqr_auth_return';

/**
 * Normaliza y valida callbackUrl (anti open-redirect): misma origin, path relativo al sitio.
 * @param {string|null|undefined} raw URL absoluta o path
 * @param {string} fallback por defecto '/'
 * @returns {string} pathname + search + hash
 */
export function getSafeCallbackUrl(raw, fallback = '/') {
  if (raw == null || String(raw).trim() === '') return fallback;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(String(raw).trim(), origin);
    if (typeof window !== 'undefined' && u.origin !== window.location.origin) {
      return fallback;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    const path = u.pathname + u.search + u.hash;
    if (!path.startsWith('/') || path.startsWith('//')) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

/** Ruta /login con callbackUrl = URL actual (incluye ?t=...) */
export function buildLoginPathWithCurrentUrl() {
  if (typeof window === 'undefined') return '/login';
  return `/login?callbackUrl=${encodeURIComponent(window.location.href)}`;
}

/** Ruta /register con callbackUrl = URL actual */
export function buildRegisterPathWithCurrentUrl() {
  if (typeof window === 'undefined') return '/register';
  return `/register?callbackUrl=${encodeURIComponent(window.location.href)}`;
}

/**
 * Antes de ir a Google OAuth: guarda a dónde volver.
 * - Si hay ?callbackUrl= (login/register), lo sanitiza y guarda.
 * - Si estás en /login o /register sin ese param, no toca storage (lo maneja syncAuthReturnStorageFromLoginPage).
 * - En cualquier otra página, guarda la URL actual completa (ej. Home).
 */
export function persistReturnUrlBeforeOAuth() {
  if (typeof window === 'undefined') return;
  try {
    const pathname = window.location.pathname;
    const onAuthForm = pathname === '/login' || pathname === '/register';
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('callbackUrl');
    if (raw) {
      const p = getSafeCallbackUrl(raw, '/');
      sessionStorage.setItem(
        AUTH_RETURN_STORAGE_KEY,
        new URL(p, window.location.origin).href
      );
      return;
    }
    if (onAuthForm) {
      return;
    }
    sessionStorage.setItem(AUTH_RETURN_STORAGE_KEY, window.location.href);
  } catch {
    sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
  }
}

/**
 * Sincroniza storage desde la URL de login/register y limpia visitas “frescas” a /login.
 * @param {{ callbackUrl: string|null, error: string|null }} searchParams
 */
export function syncAuthReturnStorageFromLoginPage(searchParams) {
  if (typeof window === 'undefined') return;
  try {
    const raw = searchParams.callbackUrl;
    if (raw) {
      const path = getSafeCallbackUrl(raw, '/');
      sessionStorage.setItem(
        AUTH_RETURN_STORAGE_KEY,
        new URL(path, window.location.origin).href
      );
      return;
    }
    if (!searchParams.error) {
      sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
    }
  } catch {
    sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
  }
}

/** Lee y borra el destino post-OAuth; devuelve path seguro para react-router o assign. */
export function consumePostAuthRedirectPath() {
  if (typeof window === 'undefined') return '/';
  try {
    const stored = sessionStorage.getItem(AUTH_RETURN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
    if (!stored) return '/';
    return getSafeCallbackUrl(stored, '/');
  } catch {
    return '/';
  }
}
