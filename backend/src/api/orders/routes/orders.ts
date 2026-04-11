/**
 * Rutas de orders. POST /api/orders/webhook es público (sin auth) para recibir notificaciones de Mercado Pago.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/webhook',
      handler: 'orders.webhook',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
