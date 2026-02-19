// backend/config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),

  // URL pública del BACKEND (donde Google redirige con el código). En local: localhost:1337
  url: env('PUBLIC_URL', 'http://localhost:1337'),

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
