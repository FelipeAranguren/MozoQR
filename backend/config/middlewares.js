// backend/config/middlewares.js
'use strict';

module.exports = [
  'strapi::errors',
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
      // Asegúrate de que FRONTEND_URL esté en tus variables de Railway
      origin: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
        .split(',')
        .map(s => s.trim()),
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
  {
    name: 'strapi::session',
    config: {
      secure: true,
      sameSite: 'none',
      proxy: true, // confiar en X-Forwarded-Proto (Railway) para ctx.secure
    },
  },
  { name: 'global::secure-headers' },
  { name: 'global::rate-limit' },
  { name: 'global::audit-log' },
  { name: 'global::idempotency-orders' },
  'strapi::favicon',
  'strapi::public',
];