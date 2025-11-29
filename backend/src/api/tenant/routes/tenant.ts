// src/api/tenant/routes/tenant.ts
export default {
  routes: [
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
      config: { policies: [], middlewares: [] },
    },
  ],
};
