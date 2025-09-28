'use strict';

module.exports = (config, { strapi }) => {
  const publicUrl = process.env.PUBLIC_URL || '';
  const isHttps = publicUrl.startsWith('https://');
  return async (ctx, next) => {
    await next();
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('Referrer-Policy', 'no-referrer');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.set("Content-Security-Policy", "frame-ancestors 'none'");
    if (isHttps) {
      ctx.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
  };
};
