'use strict';

module.exports = () => {
  return async (ctx, next) => {
    const t0 = Date.now();
    const slug = ctx.params && (ctx.params.slug || ctx.params.restaurant || ctx.params.restaurante);
    const tableSessionId = ctx.request?.body?.tableSessionId;
    try {
      await next();
    } finally {
      const ms = Date.now() - t0;
      const status = ctx.status;
      strapi.log.info(`[${ctx.method}] ${ctx.path} ${status} ${ms}ms slug=${slug || '-'} tableSessionId=${tableSessionId || '-'}`);
    }
  };
};
