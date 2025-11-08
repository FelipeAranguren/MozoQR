export default {
  routes: [
    {
      method: 'GET',
      path: '/owner/:slug/authz-check',
      handler: 'api::restaurante.owner.ownerAuthzCheck',
      config: {
        auth: {},                               // requiere login
        policies: ['global::by-restaurant-owner'], // usa la policy
      },
    },
    {
      method: 'GET',
      path: '/owner/restaurants',
      handler: 'api::restaurante.owner.listRestaurants',
      config: {
        auth: false, // temporalmente público para verificar que funciona
        policies: [], // no necesita policy específica, solo autenticación
      },
    },
  ],
};
