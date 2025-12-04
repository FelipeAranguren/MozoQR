/**
 * restaurante controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::restaurante.restaurante', ({ strapi: strapiInstance }) => ({
  
  /**
   * PUT /api/restaurantes/:id
   * - Si :id es numérico -> actualiza por id
   * - Si :id NO es numérico o tiene formato especial (como "12:1") -> extrae el número y actualiza
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

    // Convertir el parámetro a string para procesarlo
    const paramStr = String(param);
    
    // Si el parámetro contiene ":", extraer solo la parte numérica antes del ":"
    const idPart = paramStr.includes(':') ? paramStr.split(':')[0] : paramStr;
    
    // Intentar convertir a número
    const maybeNumber = Number(idPart);
    if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
      realId = Math.floor(maybeNumber);
    } else {
      // Si no es un número válido, tratar como documentId o buscar por slug
      try {
        const existing = await strapiInstance.db.query('api::restaurante.restaurante').findOne({
          where: { documentId: paramStr as any },
          select: ['id'],
        });
        if (existing?.id) {
          realId = existing.id;
        }
      } catch (err) {
        console.error('Error buscando restaurante por documentId:', err);
      }
      
      if (!realId) {
        ctx.notFound('Restaurante no encontrado');
        return;
      }
    }

    const updated = await strapiInstance.entityService.update('api::restaurante.restaurante', realId, {
      data: payload,
    });

    ctx.body = { data: updated };
  },

}));
