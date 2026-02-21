// config/env/production/middlewares.js — usados en NODE_ENV=production (Railway)
// Orden: sesión y trust-proxy lo más arriba posible, antes de security/cors
'use strict';

module.exports = [
  'strapi::errors',
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
      origin: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
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
  'strapi::body',
  { name: 'global::secure-headers' },
  { name: 'global::rate-limit' },
  { name: 'global::audit-log' },
  { name: 'global::idempotency-orders' },
  'strapi::favicon',
  'strapi::public',
];
