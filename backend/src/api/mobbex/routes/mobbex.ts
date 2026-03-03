export default {
  routes: [
    {
      method: 'POST',
      path: '/mobbex/checkout',
      handler: 'mobbex.createCheckout',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/mobbex/webhook',
      handler: 'mobbex.webhook',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

