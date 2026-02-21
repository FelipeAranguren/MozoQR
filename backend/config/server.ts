// backend/config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL'),
  // Confiar en X-Forwarded-Proto del proxy (Railway). En v5.24+ puede usarse proxy: { koa: true }
  proxy: true,
  app: {
    keys: env.array('APP_KEYS'),
  },
});