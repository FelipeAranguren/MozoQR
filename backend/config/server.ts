// backend/config/server.ts
export default ({ env }: { env: any }) => ({
  host: env('HOST', '0.0.0.0'),
  port: parseInt(env('PORT', '1337'), 10),
  url: env('PUBLIC_URL'),
  proxy: true,
  app: {
    keys: env('APP_KEYS')
      ? (typeof env('APP_KEYS') === 'string' ? env('APP_KEYS').split(',') : env('APP_KEYS'))
      : ['defaultKey1', 'defaultKey2'],
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Credencial Mercado Pago: cargada aquí para todo el ciclo de vida (Railway inyecta env al arranque).
  mercadopago: {
    accessToken: env('MP_ACCESS_TOKEN', ''),
  },
});