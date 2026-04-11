'use strict';

/**
 * Middleware temporal para depurar proxy en Railway.
 * - Loguea x-forwarded-proto y ctx.secure en /api/connect/google y callback.
 * - Fuerza ctx.req.protocol = 'https' cuando X-Forwarded-Proto es https, para que
 *   la librería "cookies" (que usa req.protocol, no ctx.secure) permita enviar cookies seguras.
 * Quitar o desactivar cuando el login con Google funcione.
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const path = ctx.path || ctx.request?.url?.split('?')[0] || '';
    const isConnect =
      path === '/api/connect/google' ||
      path.startsWith('/api/connect/google/') ||
      path === '/connect/google' ||
      path.startsWith('/connect/google/');

    const xfp = ctx.get('x-forwarded-proto') || ctx.request?.headers?.['x-forwarded-proto'];
    const secureBefore = ctx.secure;

    // La librería "cookies" comprueba req.protocol === 'https' o req.socket.encrypted.
    // Detrás de un proxy, req.socket.encrypted es false; req.protocol en Node no existe por defecto.
    // Forzamos protocol para que cookies.set(..., { secure: true }) no lance.
    if (xfp === 'https' && ctx.req) {
      ctx.req.protocol = 'https';
    }

    await next();

    if (isConnect) {
      const secureAfter = ctx.secure;
      strapi?.log?.info?.('[debug-proxy]', {
        path,
        'x-forwarded-proto': xfp,
        'ctx.secure (before)': secureBefore,
        'ctx.secure (after)': secureAfter,
        'ctx.req.protocol': ctx.req?.protocol,
      });
    }
  };
};
