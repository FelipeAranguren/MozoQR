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

/**
 * Upload: usa Cloudinary si están definidas las variables de entorno.
 * Si no, Strapi usa el provider local (archivos en public/uploads/).
 * En producción es recomendable usar Cloudinary para que las imágenes persistan entre despliegues.
 */
function getUploadConfig(env: (key: string, fallback?: string) => string) {
  const cloudName = env('CLOUDINARY_NAME', '');
  const apiKey = env('CLOUDINARY_KEY', '');
  const apiSecret = env('CLOUDINARY_SECRET', '');
  if (cloudName && apiKey && apiSecret) {
    return {
      config: {
        provider: 'cloudinary',
        providerOptions: {
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    };
  }
  return undefined;
}

export default ({ env }: { env: (key: string, fallback?: string) => string }) => {
  const uploadConfig = getUploadConfig(env);
  return {
    ...(uploadConfig && { upload: uploadConfig }),
    'users-permissions': {
    config: {
      session: {
        key: 'strapi.sid',
        rolling: true,
        renew: true,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none',
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
  };
};