export default {
  routes: [
    {
      method: 'GET',
      path: '/restaurants/:slug/loyalty/program',
      handler: 'loyalty-api.publicProgram',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/loyalty/me',
      handler: 'loyalty-api.myAccounts',
      config: { auth: {} },
    },
    {
      method: 'PUT',
      path: '/loyalty/profile',
      handler: 'loyalty-api.updateProfile',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/loyalty/transactions',
      handler: 'loyalty-api.myTransactions',
      config: { auth: {} },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/loyalty/redeem',
      handler: 'loyalty-api.redeem',
      config: { auth: {} },
    },
    {
      method: 'GET',
      path: '/owner/:slug/loyalty/program',
      handler: 'loyalty-api.ownerGetProgram',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'PUT',
      path: '/owner/:slug/loyalty/program',
      handler: 'loyalty-api.ownerUpdateProgram',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'GET',
      path: '/owner/:slug/loyalty/accounts',
      handler: 'loyalty-api.ownerListAccounts',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
    {
      method: 'POST',
      path: '/owner/:slug/loyalty/accounts/:accountId/adjust',
      handler: 'loyalty-api.ownerAdjustAccount',
      config: { auth: {}, policies: ['global::by-restaurant-owner'] },
    },
  ],
};
