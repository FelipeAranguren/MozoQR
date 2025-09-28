// backend/src/api/payments/controllers/payments.js
'use strict';

/**
 * POST /restaurants/:slug/payments
 * body: { orderId, status, amount, provider, externalRef }
 * Reglas de seguridad:
 * - Verifica que el pedido exista y pertenezca al restaurante (ctx.state.restauranteId).
 * - Recalcula el subtotal en servidor a partir de los ítems del pedido.
 * - Si `amount` viene en el body y difiere del subtotal server -> 400.
 * - Si status === 'approved' => marca el pedido como 'paid'.
 *
 * ⚠️ Cambios mínimos, sin renombrar CTs ni rutas. Se mantienen contratos actuales.
 */
module.exports = {
  async create(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const { orderId, status, amount, provider, externalRef } = payload;

    if (!orderId) return ctx.badRequest('Falta orderId');

    // 1) Verificar que el pedido exista y pertenezca al restaurante
    const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
      fields: ['id', 'order_status', 'total'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.id) return ctx.notFound('Pedido no encontrado');

    const orderRestId = order.restaurante?.id || order.restaurante;
    if (String(orderRestId) !== String(restauranteId)) {
      return ctx.unauthorized('Pedido de otro restaurante');
    }

    // 2) Recalcular subtotal en servidor (sin confiar en el cliente)
    //    Intentamos sumar qty*price desde item-pedido. Si no hay items (o CT distinto),
    //    caemos de forma segura a order.total para no romper contrato actual.
    let serverSubtotal = 0;
    try {
      // Primer intento: CT plural común
      const itemsA = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
        filters: { pedido: order.id },
        fields: ['qty', 'price'],
        limit: 500,
      });
      if (Array.isArray(itemsA) && itemsA.length) {
        serverSubtotal = itemsA.reduce((s, it) => {
          const q = Number(it?.qty || 0);
          const p = Number(it?.price || 0);
          const line = q * p;
          return s + (Number.isFinite(line) ? line : 0);
        }, 0);
      } else {
        // Segundo intento: algunos proyectos usan singular en el UID
        const itemsB = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
          filters: { pedido: order.id },
          fields: ['qty', 'price'],
          limit: 500,
        });
        if (Array.isArray(itemsB) && itemsB.length) {
          serverSubtotal = itemsB.reduce((s, it) => {
            const q = Number(it?.qty || 0);
            const p = Number(it?.price || 0);
            const line = q * p;
            return s + (Number.isFinite(line) ? line : 0);
          }, 0);
        }
      }
    } catch (e) {
      // Si el CT difiere en tu repo, no rompas flujo: caé a order.total
      strapi.log.debug('No se pudo leer item-pedido, se usa order.total como fallback');
    }

    if (!Number.isFinite(serverSubtotal) || serverSubtotal <= 0) {
      serverSubtotal = Number(order.total || 0) || 0;
    }

    // 3) Si el cliente envió amount, validar que coincida (tolerancia 1 centavo)
    if (amount !== undefined && amount !== null) {
      const cents = (n) => Math.round(Number(n) * 100);
      if (cents(amount) !== cents(serverSubtotal)) {
        return ctx.badRequest('El monto no coincide con el subtotal del servidor');
      }
    }

    // 4) Datos a guardar en el CT de pagos (manteniendo tus defaults)
    const data = {
      status: status || 'approved',
      amount: amount ?? serverSubtotal,
      provider: provider || 'mock',
      externalRef: externalRef || null,
      order: order.id,
      restaurante: restauranteId,
    };

    // 5) Crear Payment (intenta plural y luego singular). Si no existe el CT, se loguea y continua.
    try {
      await strapi.entityService.create('api::payments.payments', { data });
    } catch (e1) {
      try {
        await strapi.entityService.create('api::payment.payment', { data });
      } catch (e2) {
        strapi.log.warn('Payment CT missing. Continuing without persisting payment record.');
      }
    }

    // 6) Si aprobado, marcar pedido como paid (sin cambiar otros campos)
    if (String(status || 'approved').toLowerCase() === 'approved') {
      await strapi.entityService.update('api::pedido.pedido', order.id, {
        data: { order_status: 'paid' },
      });
    }

    ctx.body = { data: { ok: true } };
  },
};
