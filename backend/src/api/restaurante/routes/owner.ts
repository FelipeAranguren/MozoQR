// backend/src/api/restaurante/routes/owner.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/owner/:slug/authz-check',
      handler: 'api::restaurante.owner.ownerAuthzCheck',
      config: {
  auth: {
    scope: ['authenticated'], // o ['api::restaurante.ownerAuthzCheck'] si querés granularidad
  },
  policies: ['global::by-restaurant-owner'],
},

    },
  ],
};
