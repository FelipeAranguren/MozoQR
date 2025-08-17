// backend/src/api/tenant/routes/tenant.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/restaurants/:slug/orders',
      handler: 'tenant.createOrder',
      config: {
        // En MVP lo dejamos público; luego ponemos policy/ratelimit
        auth: false,
      },
    },
  ],
};
