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
 * Permite que el login con Google redirija al frontend (callback dinámico).
 * Acepta FRONTEND_URL y también 127.0.0.1 cuando FRONTEND_URL es localhost (y viceversa).
 */
export default ({ env }: { env: (key: string, fallback?: string) => string }) => ({
  'users-permissions': {
    config: {
      callback: {
        validate(callback: string, provider: Record<string, unknown> & { callback?: string }) {
          const frontendUrl = env('FRONTEND_URL', 'http://localhost:5173') || 'http://localhost:5173';
          try {
            const u = new URL(callback);
            const allowed = new URL(frontendUrl);
            if (sameLocalOrigin(u, allowed) && u.pathname === '/connect/google/redirect') {
              return;
            }
            if (u.origin === allowed.origin && u.pathname === '/connect/google/redirect') {
              return;
            }
            const providerCallback = provider?.callback;
            if (providerCallback) {
              const uProvider = new URL(providerCallback);
              if (u.origin === uProvider.origin && u.pathname === uProvider.pathname) {
                return;
              }
            }
            throw new Error('Forbidden callback provided');
          } catch (e: unknown) {
            const err = e as Error;
            if (err?.message === 'Forbidden callback provided') throw e;
            throw new Error('The callback is not a valid URL');
          }
        },
      },
    },
  },
});
