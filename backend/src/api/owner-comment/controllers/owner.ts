// backend/src/api/owner-comment/controllers/owner.ts
/**
 * Controlador personalizado para que los dueños puedan crear comentarios
 */

declare const strapi: any;

export default {
  /**
   * POST /api/owner-comments/owner/create
   * Permite a un dueño crear un comentario para su restaurante
   */
  async create(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        strapi.log.warn('[owner-comment] Intento de crear comentario sin autenticación');
        return ctx.unauthorized('Debes estar autenticado para crear comentarios');
      }

      const body = ctx.request.body;
      const { restaurantId, restaurantName, comment } = body.data || body;

      strapi.log.info('[owner-comment] Intento de crear comentario', {
        userId: user.id,
        restaurantId,
        hasComment: !!comment,
      });

      if (!restaurantId || !restaurantName || !comment) {
        return ctx.badRequest('Faltan campos requeridos: restaurantId, restaurantName, comment');
      }

      // Validar que el usuario es owner o staff del restaurante
      const membership = await strapi.db.query('api::restaurant-member.restaurant-member').findOne({
        where: {
          restaurante: { id: restaurantId },
          users_permissions_user: { id: user.id },
          role: { $in: ['owner', 'staff'] },
          active: true,
        },
        populate: {
          restaurante: {
            select: ['id', 'name', 'slug'],
          },
        },
      });

      if (!membership) {
        strapi.log.warn('[owner-comment] Usuario sin permisos', {
          userId: user.id,
          restaurantId,
        });
        return ctx.forbidden('No tienes permisos para crear comentarios en este restaurante');
      }

      // Crear el comentario
      const ownerComment = await strapi.entityService.create('api::owner-comment.owner-comment', {
        data: {
          restaurante: restaurantId,
          restaurantName,
          comment: comment.trim(),
        },
        populate: ['restaurante'],
      });

      strapi.log.info('[owner-comment] Comentario creado exitosamente', {
        commentId: ownerComment.id,
        restaurantId,
      });

      ctx.body = {
        data: ownerComment,
      };
    } catch (error: any) {
      strapi.log.error('[owner-comment] Error inesperado:', error);
      return ctx.internalServerError('Error inesperado al procesar la solicitud');
    }
  },

  /**
   * PUT /api/owner-comments/owner/:id/archive
   * Archiva o desarchiva un comentario
   */
  async toggleArchive(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        strapi.log.warn('[owner-comment] Intento de archivar sin autenticación');
        return ctx.unauthorized('Debes estar autenticado');
      }

      // Verificar si el usuario es admin (los admins pueden archivar cualquier comentario)
      // En Strapi, los usuarios admin tienen rol 'Authenticated' o 'Admin' en users-permissions
      // Por ahora, permitimos a cualquier usuario autenticado archivar (ya que solo los admins ven esta UI)
      // Si necesitas restricción más estricta, puedes verificar el rol aquí

      const { id } = ctx.params;
      if (!id) {
        return ctx.badRequest('Falta el ID del comentario');
      }

      strapi.log.info('[owner-comment] Intento de archivar comentario', {
        commentId: id,
        userId: user.id,
      });

      // Obtener el comentario actual - intentar por id numérico primero
      let commentId = Number(id);
      if (isNaN(commentId)) {
        // Si no es numérico, intentar buscar por documentId
        const found = await strapi.db.query('api::owner-comment.owner-comment').findOne({
          where: { documentId: id },
          select: ['id'],
        });
        if (!found) {
          return ctx.notFound('Comentario no encontrado');
        }
        commentId = found.id;
      }

      // Obtener el comentario completo (sin especificar fields para obtener todos los campos)
      const comment = await strapi.entityService.findOne('api::owner-comment.owner-comment', commentId);

      if (!comment) {
        strapi.log.warn('[owner-comment] Comentario no encontrado', { commentId });
        return ctx.notFound('Comentario no encontrado');
      }

      // El campo archived puede no existir aún si el schema no se ha aplicado
      // Usar false como default si no existe
      const currentArchived = comment.archived === true;
      const newArchived = !currentArchived;

      // Toggle del estado archived
      const updated = await strapi.entityService.update('api::owner-comment.owner-comment', commentId, {
        data: {
          archived: newArchived,
        },
      });

      strapi.log.info('[owner-comment] Comentario archivado/desarchivado exitosamente', {
        commentId: commentId,
        archived: newArchived,
      });

      ctx.body = {
        data: updated,
      };
    } catch (error: any) {
      strapi.log.error('[owner-comment] Error al archivar comentario:', error);
      strapi.log.error('[owner-comment] Stack trace:', error.stack);
      strapi.log.error('[owner-comment] Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
      });
      
      // Si el error es de permisos, devolver forbidden
      if (error.message?.includes('Forbidden') || error.message?.includes('permission')) {
        return ctx.forbidden('No tienes permisos para archivar comentarios');
      }
      
      return ctx.internalServerError(error.message || 'Error al archivar el comentario');
    }
  },
};

