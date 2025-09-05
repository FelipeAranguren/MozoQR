// backend/src/api/payments/controllers/payments.js
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

    // Verificar que el pedido exista y pertenezca al restaurante
    const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
      fields: ['id', 'order_status', 'total'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.id) return ctx.notFound('Pedido no encontrado');
    if (String(order.restaurante?.id || order.restaurante) !== String(restauranteId)) {
      return ctx.unauthorized('Pedido de otro restaurante');
    }

    // Datos a guardar en el CT de pagos
    const data = {
      status: status || 'approved',
      amount: amount ?? order.total,
      provider: provider || 'mock',
      externalRef: externalRef || null,
      order: order.id,
      restaurante: restauranteId,
    };

    // Crear Payment (intenta plural y luego singular)
    try {
      await strapi.entityService.create('api::payments.payments', { data });
    } catch (e1) {
      try {
        await strapi.entityService.create('api::payment.payment', { data });
      } catch (e2) {
        strapi.log.warn('Payment CT missing. Continuing without persisting payment record.');
      }
    }

    // Si aprobado, marcar pedido como paid
    if (String(status || 'approved').toLowerCase() === 'approved') {
      await strapi.entityService.update('api::pedido.pedido', order.id, {
        data: { order_status: 'paid' },
      });
    }

    ctx.body = { data: { ok: true } };
  },
};
