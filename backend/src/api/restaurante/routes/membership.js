// backend/src/api/restaurante/routes/membership.ts
export default {
  routes: [
    // ping sin auth para verificar carga
    {
      method: 'GET',
      path: '/restaurants/ping-membership',
      handler: 'membership.ping',
      config: { auth: false },
    },
    // endpoint real
    {
      method: 'GET',
      path: '/restaurants/:slug/membership',
      handler: 'membership.me',
      config: {
        auth: true,
        // policies: ['global::by-restaurant'], // activalo después de probar
      },
    },
  ],
};