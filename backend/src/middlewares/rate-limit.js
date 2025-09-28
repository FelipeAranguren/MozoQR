'use strict';

// Rate limit simple en memoria por IP+ruta: 60 req / 60s
const WINDOW_MS = 60 * 1000;
const LIMIT = 60;
const buckets = new Map();

module.exports = () => {
  return async (ctx, next) => {
    const key = `${ctx.ip}:${ctx.path}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { count: 0, reset: now + WINDOW_MS };
      buckets.set(key, b);
    }
    if (now > b.reset) {
      b.count = 0;
      b.reset = now + WINDOW_MS;
    }
    b.count += 1;

    ctx.set('X-RateLimit-Limit', String(LIMIT));
    ctx.set('X-RateLimit-Remaining', String(Math.max(LIMIT - b.count, 0)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(b.reset / 1000)));

    if (b.count > LIMIT) {
      ctx.status = 429;
      ctx.body = { error: 'Too Many Requests' };
      return;
    }

    await next();
  };
};
