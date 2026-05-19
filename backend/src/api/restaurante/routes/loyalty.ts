/** Fidelización — registrado en api::restaurante para que exista en producción. */
export default {
  routes: [
    {
      method: 'GET',
      path: '/restaurants/:slug/loyalty/program',
      handler: 'api::restaurante.loyalty.publicProgram',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/loyalty/me',
      handler: 'api::restaurante.loyalty.myAccounts',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/loyalty/profile',
      handler: 'api::restaurante.loyalty.updateProfile',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/loyalty/transactions',
      handler: 'api::restaurante.loyalty.myTransactions',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/loyalty/redeem',
      handler: 'api::restaurante.loyalty.redeem',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/owner/:slug/loyalty/program',
      handler: 'api::restaurante.loyalty.ownerGetProgram',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'PUT',
      path: '/owner/:slug/loyalty/program',
      handler: 'api::restaurante.loyalty.ownerUpdateProgram',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/owner/:slug/loyalty/accounts',
      handler: 'api::restaurante.loyalty.ownerListAccounts',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'POST',
      path: '/owner/:slug/loyalty/accounts/:accountId/adjust',
      handler: 'api::restaurante.loyalty.ownerAdjustAccount',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
  ],
};
