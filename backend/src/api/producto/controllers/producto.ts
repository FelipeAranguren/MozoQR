/**
 * producto controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::producto.producto', ({ strapi }) => ({
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

    let realId: number | null = null;

    // ¿Es un número válido?
    const maybeNumber = Number(param);
    if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
      realId = maybeNumber;
    } else {
      // Tratar como documentId
      const existing = await strapi.db.query('api::producto.producto').findOne({
        where: { documentId: param as any },
        select: ['id'],
      });
      if (!existing?.id) {
        ctx.notFound('Producto no encontrado');
        return;
      }
      realId = existing.id;
    }

    const deleted = await strapi.entityService.delete('api::producto.producto', realId);

    ctx.body = { data: deleted };
  },
}));
