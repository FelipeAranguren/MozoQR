/**
 * producto controller
 */

import { factories } from '@strapi/strapi'

// Helper para resolver el ID real (numérico o documentId)
async function resolveProductId(strapi: any, param: string): Promise<number | null> {
  if (!param) return null;

  // ¿Es un número válido?
  const maybeNumber = Number(param);
  if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
    return maybeNumber;
  }

  // Tratar como documentId
  const existing = await strapi.db.query('api::producto.producto').findOne({
    where: { documentId: param as any },
    select: ['id'],
  });
  
  return existing?.id || null;
}

export default factories.createCoreController('api::producto.producto', ({ strapi }) => ({
  /**
   * PUT /api/productos/:id
   * - Si :id es numérico -> actualiza por id
   * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
   */
  async update(ctx) {
    const param = ctx.params?.id;
    const payload = ctx.request?.body?.data || ctx.request?.body || {};

    if (!param) {
      ctx.badRequest('Missing id param');
      return;
    }

    const realId = await resolveProductId(strapi, param);
    if (!realId) {
      ctx.notFound('Producto no encontrado');
      return;
    }

    const updated = await strapi.entityService.update('api::producto.producto', realId, {
      data: payload,
    });

    ctx.body = { data: updated };
  },

  /**
   * DELETE /api/productos/:id
   * - Si :id es numérico -> elimina por id
   * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
   */
  async delete(ctx) {
    const param = ctx.params?.id;

    if (!param) {
      ctx.badRequest('Missing id param');
      return;
    }

    const realId = await resolveProductId(strapi, param);
    if (!realId) {
      ctx.notFound('Producto no encontrado');
      return;
    }

    const deleted = await strapi.entityService.delete('api::producto.producto', realId);

    ctx.body = { data: deleted };
  },
}));
