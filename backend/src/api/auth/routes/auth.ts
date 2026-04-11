/**
 * Callback OAuth Mercado Pago (público: el navegador del usuario llega desde MP).
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/auth/mercadopago/callback',
      handler: 'auth.mercadoPagoCallback',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
