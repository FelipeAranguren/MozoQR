/**
 * localhost y 127.0.0.1 se consideran el mismo origen para el mismo puerto.
 */
function sameLocalOrigin(a: URL, b: URL): boolean {
  if (a.origin === b.origin) return true;
  const aLocal = a.hostname === 'localhost' || a.hostname === '127.0.0.1';
  const bLocal = b.hostname === 'localhost' || b.hostname === '127.0.0.1';
  return aLocal && bLocal && a.port === b.port && a.protocol === b.protocol;
}

/**
 * Orígenes permitidos desde FRONTEND_URL (varios separados por coma).
 */
function getAllowedOrigins(env: any): string[] {
  let raw = '';
  try {
    if (typeof env === 'function') {
      raw = env('FRONTEND_URL', '') || '';
    }
  } catch {
    // ignore
  }
  if (!raw && typeof process !== 'undefined' && process.env) {
    raw = process.env.FRONTEND_URL || '';
  }
  if (!raw) raw = 'http://localhost:5173';
  return String(raw)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

export default ({ env }: { env: (key: string, fallback?: string) => string }) => ({
  'users-permissions': {
    config: {
      // Sesión coherente con producción detrás de proxy HTTPS (Railway).
      // Requiere proxy: { koa: true } en server.ts y app.proxy = true en src/index.ts
      // para que ctx.secure sea true y no falle "Cannot send secure cookie over unencrypted connection".
      session: {
        key: 'strapi.sid',
        rolling: true,
        renew: true,
        cookie: {
          secure: true, // Indispensable para HTTPS en producción
          sameSite: 'none', // Permite cookie entre dominios (Railway <-> Vercel) para Google OAuth
          httpOnly: true,
        },
      },

      callback: {
        validate(callback: string, provider: Record<string, unknown> & { callback?: string }) {
          const forbid = () => {
            throw new Error('Forbidden callback provided');
          };
          try {
            if (typeof callback !== 'string' || !callback.trim()) forbid();
            const u = new URL(callback.trim());
            if (u.pathname !== '/connect/google/redirect') forbid();

            // 1) Aceptar cualquier *.vercel.app
            if (u.protocol === 'https:' && u.hostname.toLowerCase().endsWith('.vercel.app')) {
              return;
            }

            // 2) FRONTEND_URL (Strapi env o process.env en Railway)
            const allowedOrigins = getAllowedOrigins(env);
            if (allowedOrigins.length > 0 && allowedOrigins.includes(u.origin)) {
              return;
            }

            const firstAllowed = allowedOrigins[0];
            if (firstAllowed) {
              try {
                const allowed = new URL(firstAllowed);
                if (sameLocalOrigin(u, allowed)) return;
              } catch {
                // ignore invalid URL
              }
            }

            const providerCallback = provider?.callback;
            if (typeof providerCallback === 'string') {
              try {
                const uProvider = new URL(providerCallback);
                if (u.origin === uProvider.origin && u.pathname === uProvider.pathname) {
                  return;
                }
              } catch {
                // ignore
              }
            }
            forbid();
          } catch (e: unknown) {
            const err = e as Error;
            if (err?.message === 'Forbidden callback provided') throw e;
            throw new Error('Forbidden callback provided');
          }
        },
      },
    },
  },
});