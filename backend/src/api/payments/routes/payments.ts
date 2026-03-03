/**
 * Rutas de pagos. auth: false evita que users-permissions exija JWT.
 * En Admin: Settings > Users & Permissions > Permissions > Payment,
 * marcar createPreference (y ping, card-pay, confirm) como Public si hace falta.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/payments/ping',
      handler: 'payments.ping',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/payments/create-preference',
      handler: 'payments.createPreference',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/payments/card-pay',
      handler: 'payments.cardPay',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/payments/confirm',
      handler: 'payments.confirm',
      config: { auth: false, policies: [], middlewares: [] },
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
