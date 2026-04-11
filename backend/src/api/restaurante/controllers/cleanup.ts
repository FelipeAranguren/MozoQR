/**
 * cleanup controller - Limpia sesiones antiguas
 */

declare const strapi: any;

export default {
  /**
   * POST /restaurants/:slug/cleanup/old-sessions
   * Limpia sesiones abiertas muy antiguas (más de 7 días) o cerradas hace más de 30 días
   * Requiere autenticación y acceso al restaurante
   */
  async cleanOldSessions(ctx: any) {
    const { slug } = ctx.params;
    const { daysOpen = 7, daysClosed = 30 } = ctx.request.body || {};

    try {
      // 1. Encontrar el restaurante
      const restaurant = await strapi.db.query('api::restaurante.restaurante').findOne({
        where: { slug },
        select: ['id'],
      });

      if (!restaurant) {
        return ctx.notFound('Restaurante no encontrado');
      }

      const now = new Date();
      const openThreshold = new Date(now.getTime() - daysOpen * 24 * 60 * 60 * 1000);
      const closedThreshold = new Date(now.getTime() - daysClosed * 24 * 60 * 60 * 1000);

      // 2. Buscar sesiones abiertas muy antiguas (más de X días)
      const oldOpenSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: {
          restaurante: restaurant.id,
          session_status: 'open',
          $or: [
            { openedAt: { $lt: openThreshold } },
            { createdAt: { $lt: openThreshold } }, // Si no tiene openedAt, usar createdAt
          ],
        },
        select: ['id'],
      });

      // 3. Buscar sesiones cerradas muy antiguas (más de Y días)
      const oldClosedSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: {
          restaurante: restaurant.id,
          session_status: { $in: ['closed', 'paid'] },
          $or: [
            { closedAt: { $lt: closedThreshold } },
            { updatedAt: { $lt: closedThreshold } }, // Si no tiene closedAt, usar updatedAt
          ],
        },
        select: ['id'],
      });

      const allOldSessionIds = [
        ...oldOpenSessions.map((s: any) => s.id),
        ...oldClosedSessions.map((s: any) => s.id),
      ];

      let deletedCount = 0;

      if (allOldSessionIds.length > 0) {
        // 4. Eliminar las sesiones antiguas
        await strapi.db.query('api::mesa-sesion.mesa-sesion').deleteMany({
          where: { id: { $in: allOldSessionIds } },
        });
        deletedCount = allOldSessionIds.length;
      }

      return ctx.send({
        message: 'Limpieza completada',
        deleted: deletedCount,
        details: {
          openSessionsDeleted: oldOpenSessions.length,
          closedSessionsDeleted: oldClosedSessions.length,
          thresholdOpen: daysOpen,
          thresholdClosed: daysClosed,
        },
      });
    } catch (err: any) {
      console.error('Error limpiando sesiones antiguas:', err);
      return ctx.internalServerError('Error al limpiar sesiones antiguas: ' + (err?.message || 'Error desconocido'));
    }
  },
};

