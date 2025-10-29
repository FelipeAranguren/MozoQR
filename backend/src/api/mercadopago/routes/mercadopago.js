export default {
  routes: [
    {
      method: 'POST',
      path: '/mercadopago/create-preference',
      handler: 'mercadopago.createPreference',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/mercadopago/webhook',
      handler: 'mercadopago.webhook',
      config: { auth: false },
    },
  ],
};
