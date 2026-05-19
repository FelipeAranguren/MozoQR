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
      path: '/owner/:slug/ai-status',
      handler: 'api::restaurante.owner.aiStatus',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/owner/:slug/weekly-ai-report',
      handler: 'api::restaurante.owner.weeklyAiReport',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'GET',
      path: '/owner/restaurants',
      handler: 'api::restaurante.owner.listRestaurants',
      config: {
        auth: {}, // requiere autenticación
        policies: [], // no necesita policy específica, solo autenticación
      },
    },
  ],
};
