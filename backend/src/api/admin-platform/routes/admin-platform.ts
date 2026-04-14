export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/users',
      handler: 'admin-platform.listUsers',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/users/:id',
      handler: 'admin-platform.getUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users',
      handler: 'admin-platform.createUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id',
      handler: 'admin-platform.updateUser',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id/block',
      handler: 'admin-platform.toggleBlock',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/users/:id/reset-password',
      handler: 'admin-platform.resetPassword',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'GET',
      path: '/admin/memberships',
      handler: 'admin-platform.listMemberships',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'PUT',
      path: '/admin/memberships/:id',
      handler: 'admin-platform.updateMembership',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/memberships',
      handler: 'admin-platform.createMembership',
      config: { auth: {}, policies: ['global::is-platform-admin'] },
    },
  ],
};
