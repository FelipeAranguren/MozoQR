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
  ],
};
