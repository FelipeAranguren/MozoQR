// src/api/tenant/routes/tenant.ts
export default {
  routes: [
    // ---------------- Tables (Source of Truth) ----------------
    {
      method: 'GET',
      path: '/restaurants/:slug/tables',
      handler: 'tenant.listTables',
      config: { policies: [], middlewares: [], auth: false },
    },
    {
      method: 'GET',
      path: '/restaurants/:slug/tables/:number',
      handler: 'tenant.getTable',
      config: { policies: [], middlewares: [], auth: false },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/tables/claim',
      handler: 'tenant.claimTable',
      config: { policies: [], middlewares: [], auth: false },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/tables/release',
      handler: 'tenant.releaseTable',
      config: { policies: [], middlewares: [], auth: false },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/orders',
      handler: 'tenant.createOrder',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/close-account',
      handler: 'tenant.closeAccount',
      config: { policies: [], middlewares: [] },
    },
    // opcional: permitir cerrar cuenta también con PUT
    {
      method: 'PUT',
      path: '/restaurants/:slug/close-account',
      handler: 'tenant.closeAccount',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/open-session',
      handler: 'tenant.openSession',
      config: { policies: [], middlewares: [], auth: false }, // Público - no requiere autenticación
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/close-session',
      handler: 'tenant.closeSession',
      config: { auth: {}, policies: ['global::by-restaurant-owner'], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/tables/force-release-all',
      handler: 'tenant.forceReleaseAllTables',
      config: { auth: {}, policies: ['global::by-restaurant-owner'], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/reset-tables',
      handler: 'tenant.resetTables',
      config: { policies: [], middlewares: [], auth: false },
    },
    {
      method: 'GET',
      path: '/restaurants/debug-session/:id',
      handler: 'tenant.debugSession',
      config: { policies: [], middlewares: [], auth: false },
    },
  ],
};
