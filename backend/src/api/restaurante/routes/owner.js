//backend/src/api/restaurante/routes/owner.js
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/owner/:slug/authz-check',
      handler: 'api::restaurante.owner.ownerAuthzCheck',
      config: { auth: true, policies: ['global::by-restaurant-owner'] },
    },
  ],
};
