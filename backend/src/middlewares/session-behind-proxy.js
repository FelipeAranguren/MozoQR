'use strict';

/**
 * Fuerza secure: false en las cookies cuando estamos detrás de un proxy (Railway, etc.).
 * El proxy termina HTTPS y envía HTTP al proceso, por eso la librería cookies lanza
 * "Cannot send secure cookie over unencrypted connection". Este middleware parchea
 * ctx.cookies.set para que siempre pase secure: false.
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const originalSet = ctx.cookies.set;
    if (typeof originalSet === 'function') {
      ctx.cookies.set = function (name, value, opts) {
        const patched = opts ? { ...opts, secure: false } : { secure: false };
        return originalSet.call(ctx.cookies, name, value, patched);
      };
    }
    await next();
  };
};
