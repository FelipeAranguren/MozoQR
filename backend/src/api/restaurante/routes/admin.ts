/** Super Admin — registrado en api::restaurante para que exista en producción. */
export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/auth-check',
      handler: 'api::restaurante.admin.authCheck',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/permissions-overview',
      handler: 'api::restaurante.admin.permissionsOverview',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/customers',
      handler: 'api::restaurante.admin.listCustomers',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/users',
      handler: 'api::restaurante.admin.listUsers',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/users/:id',
      handler: 'api::restaurante.admin.getUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/users/:id/detail',
      handler: 'api::restaurante.admin.getUserDetail',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/:id/impersonate',
      handler: 'api::restaurante.admin.impersonateUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/:id/loyalty-accounts/:accountId/adjust',
      handler: 'api::restaurante.admin.adjustUserLoyalty',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users',
      handler: 'api::restaurante.admin.createUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id',
      handler: 'api::restaurante.admin.updateUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id/block',
      handler: 'api::restaurante.admin.toggleBlock',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id/reset-password',
      handler: 'api::restaurante.admin.resetPassword',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/memberships',
      handler: 'api::restaurante.admin.listMemberships',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/memberships/:id',
      handler: 'api::restaurante.admin.updateMembership',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/memberships',
      handler: 'api::restaurante.admin.createMembership',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
  ],
};
