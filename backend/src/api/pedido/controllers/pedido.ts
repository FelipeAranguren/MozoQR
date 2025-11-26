// src/api/pedido/controllers/pedido.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pedido.pedido', ({ strapi: strapiInstance }) => ({

  /**
   * PUT /api/pedidos/:id
   * - Si :id es numérico -> actualiza por id
   * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
   */
  async update(ctx) {
    const param = ctx.params?.id;
    const payload =
      (ctx.request?.body && (ctx.request.body as any).data) ||
      ctx.request?.body ||
      {};

    if (!param) {
      ctx.badRequest('Missing id param');
      return;
    }
    if (!payload || typeof payload !== 'object') {
      ctx.badRequest('Missing data');
      return;
    }

    let realId: number | null = null;

    // ¿Es un número válido?
    const maybeNumber = Number(param);
    if (Number.isFinite(maybeNumber)) {
      realId = maybeNumber;
    } else {
      // Tratar como documentId
      const existing = await strapiInstance.db.query('api::pedido.pedido').findOne({
        where: { documentId: param as any },
        select: ['id'],
      });
      if (!existing?.id) {
        ctx.notFound('Pedido no encontrado');
        return;
      }
      realId = existing.id;
    }

    const updated = await strapiInstance.entityService.update('api::pedido.pedido', realId, {
      data: payload,
    });

    ctx.body = { data: updated };
  },

}));