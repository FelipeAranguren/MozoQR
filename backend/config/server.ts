// backend/config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),

  // URL pública para generar correctamente los redirects de /api/connect/*
  url: env('PUBLIC_URL', 'https://mozoqr-isjnzx9gc-felipearangurens-projects.vercel.app'),

  // Si más adelante usás Nginx/Heroku/Render, podés activar esto:
  proxy: true,

  app: {
    keys: env.array('APP_KEYS', [
      'defaultKeyOne',
      'defaultKeyTwo',
      'defaultKeyThree',
      'defaultKeyFour',
    ]),
  },
});
