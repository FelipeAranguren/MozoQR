export default {
  routes: [
    {
      method: 'GET',
      path: '/payments/ping',
      handler: 'payments.ping',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/payments/create-preference',
      handler: 'payments.createPreference',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/payments/card-pay',
      handler: 'payments.cardPay',
      config: { policies: [], middlewares: [] },
    },

    {
      method: 'GET',
      path: '/payments/confirm',
      handler: 'payments.confirm',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/restaurants/:slug/payments',
      handler: 'payments.create',
      config: {
        policies: ['global::by-restaurant'],
      },
    },
    // Si luego agregás webhook, sumá aquí:
    // {
    //   method: 'POST',
    //   path: '/payments/webhook',
    //   handler: 'payments.webhook',
    //   config: { auth: false },
    // },
  ],
};
