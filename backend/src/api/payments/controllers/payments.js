// backend/src/api/payment/controllers/payments.js
'use strict';

/**
 * POST /restaurants/:slug/payments
 * body: { orderId, status, amount, provider, externalRef }
 * If status === 'approved' => marks order as 'paid'
 */
module.exports = {
  async create(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const { orderId, status, amount, provider, externalRef } = payload;

    if (!orderId) return ctx.badRequest('Falta orderId');

    // Verify order belongs to restaurant
    const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
      fields: ['id', 'order_status', 'total'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.id) return ctx.notFound('Pedido no encontrado');
    if (String(order.restaurante?.id || order.restaurante) !== String(restauranteId)) {
      return ctx.unauthorized('Pedido de otro restaurante');
    }

    // Create payment (if content-type exists)
    try {
      await strapi.entityService.create('api::payment.payment', {
        data: {
          status: status || 'approved',
          amount: amount ?? order.total,
          provider: provider || 'mock',
          externalRef: externalRef || null,
          order: order.id,
          restaurante: restauranteId,
        },
      });
    } catch (e) {
      // Swallow if model not present; this is optional in MVP
      strapi.log.warn('Payment model missing or failed to create. Continuing.');
    }

    // If approved, mark order as paid
    if (String(status || 'approved').toLowerCase() === 'approved') {
      await strapi.entityService.update('api::pedido.pedido', order.id, {
        data: { order_status: 'paid' },
      });
    }

    ctx.body = { data: { ok: true } };
  },
};
