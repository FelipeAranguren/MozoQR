// src/api/pedido/controllers/pedido.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pedido.pedido', ({ strapi: strapiInstance }) => ({

  /**
   * GET /api/pedidos/:id
   * - Si :id es numérico -> busca por id
   * - Si :id NO es numérico -> busca por documentId (Strapi v5)
   */
  async findOne(ctx) {
    const param = ctx.params?.id;
    if (!param) {
      return ctx.badRequest('Missing id param');
    }
    const maybeNumber = Number(param);
    let realId: number | null = Number.isFinite(maybeNumber) ? maybeNumber : null;
    if (realId === null) {
      const existing = await strapiInstance.db.query('api::pedido.pedido').findOne({
        where: { documentId: param as string },
        select: ['id'],
      });
      if (!existing?.id) {
        return ctx.notFound('Pedido no encontrado');
      }
      realId = existing.id;
    }
    const entity = await strapiInstance.entityService.findOne('api::pedido.pedido', realId);
    if (!entity) {
      return ctx.notFound('Pedido no encontrado');
    }
    ctx.body = { data: entity };
  },

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