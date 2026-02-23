// config/env/production/server.ts — manda sobre config/server.ts en NODE_ENV=production (Railway)
export default ({ env }: { env: any }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL'),
  app: {
    keys: env.array('APP_KEYS'),
  },
  mercadopagoToken: env('MP_ACCESS_TOKEN') || env('MERCADOPAGO_ACCESS_TOKEN') || env('MERCADO_PAGO_ACCESS_TOKEN'),
  // Obligatorio en producción detrás de proxy: confiar en X-Forwarded-Proto
  proxy: true,
});
