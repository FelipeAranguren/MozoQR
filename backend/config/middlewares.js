// backend/config/middlewares.js
// Orden: debug + sesión lo antes posible, antes de security/cors (para no perder headers)
// CORS: aplica a peticiones del navegador hacia este backend. Incluir https://mozoqr.vercel.app en CORS_ORIGINS.
// Las llamadas del backend a https://api.mercadopago.com son server-to-server (sin CORS); no hace falta permitirlas aquí.
'use strict';

module.exports = [
  'strapi::errors',
  'strapi::body',
  { name: 'global::debug-proxy-headers' },
  {
    name: 'strapi::session',
    config: {
      secure: true,
      sameSite: 'none',
      proxy: true,
    },
  },
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://mozoqr.vercel.app', 'https://www.mercadopago.com.ar', 'https://www.mercadopago.com']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      keepHeadersOnError: true,
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  { name: 'global::secure-headers' },
  { name: 'global::rate-limit' },
  { name: 'global::audit-log' },
  { name: 'global::idempotency-orders' },
  'strapi::favicon',
  'strapi::public',
];
