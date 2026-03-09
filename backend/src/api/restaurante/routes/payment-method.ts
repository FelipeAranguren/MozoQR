/**
 * Rutas para obtener y actualizar el método de pago Mercado Pago por slug del restaurante.
 * GET/PUT /restaurants/:slug/payment-method
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/restaurants/:slug/payment-method',
      handler: 'payment-method.find',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
    {
      method: 'PUT',
      path: '/restaurants/:slug/payment-method',
      handler: 'payment-method.update',
      config: {
        auth: {},
        policies: ['global::by-restaurant-owner'],
      },
    },
  ],
};
