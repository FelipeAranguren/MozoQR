'use strict';

const crypto = require('crypto');
const CACHE_TTL = 90 * 1000; // 90s
const cache = new Map();

function sanitize(s) {
  if (!s) return s;
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function autoKeyFrom(ctx) {
  const b = ctx.request.body || {};
  const raw = JSON.stringify({
    slug: ctx.params.slug,
    table: b.table,
    sid: b.tableSessionId,
    items: b.items,
  });
  return 'auto:' + crypto.createHash('sha1').update(raw).digest('hex');
}

module.exports = () => {
  return async (ctx, next) => {
    // Solo aplica a POST /restaurants/:slug/orders
    if (ctx.method !== 'POST') return next();
    const m = ctx.path.match(/^\/restaurants\/[^/]+\/orders\/?$/);
    if (!m) return next();

    // Sanitizar notas del body (anti-XSS)
    const b = ctx.request.body || {};
    if (b.customerNotes) b.customerNotes = sanitize(b.customerNotes);
    if (Array.isArray(b.items)) {
      b.items = b.items.map(it => ({ ...it, notes: sanitize(it.notes) }));
    }

    // Idempotency-Key (o autogenerada)
    const headerKey = ctx.get('Idempotency-Key');
    const key = headerKey ? `hdr:${headerKey}` : autoKeyFrom(ctx);

    const now = Date.now();
    const entry = cache.get(key);
    if (entry && now - entry.t < CACHE_TTL) {
      // Devolver misma respuesta de la primera ejecución
      ctx.status = entry.status;
      ctx.body = entry.body;
      for (const [h, v] of Object.entries(entry.headers || {})) ctx.set(h, v);
      return;
    }

    // Ejecutar controlador
    await next();

    // Guardar snapshot de respuesta
    cache.set(key, {
      t: now,
      status: ctx.status,
      body: ctx.body,
      headers: {
        'Idempotency-Key': headerKey || key,
      },
    });

    // Propagar header
    ctx.set('Idempotency-Key', headerKey || key);
  };
};
