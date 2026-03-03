// backend/config/middlewares.js
// Orden: debug + sesión lo antes posible, antes de security/cors (para no perder headers)
// CORS: aplica a peticiones del navegador hacia este backend. Incluir https://mozoqr.vercel.app en CORS_ORIGINS.
// Las llamadas del backend a https://api.mercadopago.com son server-to-server (sin CORS); no hace falta permitirlas aquí.
'use strict';

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5174,http://localhost:5173,http://localhost:3000,https://mozoqr.vercel.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
          // Permitir imágenes y media desde Cloudinary (cuando se usa upload externo)
          'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'Idempotency-Key',
        'Cache-Control',
        'Pragma',
        'X-Requested-With',
      ],
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
