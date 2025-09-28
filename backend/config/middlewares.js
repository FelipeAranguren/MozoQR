'use strict';

module.exports = [
  // CORS restringido por env (incluye Idempotency-Key para habilitar la idempotencia desde el front)
  {
    name: 'strapi::cors',
    config: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
        .split(',')
        .map(s => s.trim()),
      methods: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'],
      headers: ['Content-Type','Authorization','Idempotency-Key'],
      keepHeadersOnError: true,   // ✅ (con "s")
      credentials: true,
    },
  },

  // Headers de seguridad básicos (X-Content-Type-Options, Referrer-Policy, CSP frame-ancestors 'none', HSTS si PUBLIC_URL=https)
  { name: 'global::secure-headers' },

  // Rate limit en memoria por IP+ruta
  { name: 'global::rate-limit' },

  // Audit log sin PII (método, ruta, status, slug, tableSessionId)
  { name: 'global::audit-log' },

  // Idempotencia + sanitizado SOLO en POST /restaurants/:slug/orders
  { name: 'global::idempotency-orders' },

  // --- middlewares core de Strapi ---
  'strapi::errors',

  // Tu config de security con CSP para connect-src
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Habilita conexiones a API/dev websockets
          'connect-src': ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
        },
      },
    },
  },

  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
