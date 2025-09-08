'use strict';

// backend/src/api/tenant/routes/tenant.js
module.exports = {
  routes: [
    // MENUS (public GET)
    {
      method: 'GET',
      path: '/restaurants/:slug/menus',
      handler: 'tenant.menus',
      config: { policies: ['api::tenant.by-restaurant'], middlewares: [] },
    },

    // ORDERS (public POST)
    {
      method: 'POST',
      path: '/restaurants/:slug/orders',
      handler: 'tenant.createOrder',
      config: { policies: ['api::tenant.by-restaurant'], middlewares: [] },
    },

    // ORDERS list (staff/owner)
    {
      method: 'GET',
      path: '/restaurants/:slug/orders',
      handler: 'tenant.listOrders',
      config: {
        policies: ['api::tenant.by-restaurant', 'plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },

    // ORDER status patch (staff/owner)
    {
      method: 'PATCH',
      path: '/restaurants/:slug/orders/:id/status',
      handler: 'tenant.updateOrderStatus',
      config: {
        policies: ['api::tenant.by-restaurant', 'plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },

    // PAYMENTS (mock, public POST)
    {
      method: 'POST',
      path: '/restaurants/:slug/payments',
      handler: 'tenant.createPaymentMock',
      config: { policies: ['api::tenant.by-restaurant'], middlewares: [] },
    },

    // CLOSE ACCOUNT (opcional)
    {
      method: 'POST',
      path: '/restaurants/:slug/close-account',
      handler: 'tenant.closeAccount',
      config: { policies: ['api::tenant.by-restaurant'], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/close-account',
      handler: 'tenant.closeAccount',
      config: { policies: ['api::tenant.by-restaurant'], middlewares: [] },
    },
  ],
};
