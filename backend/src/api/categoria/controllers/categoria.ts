/**
 * categoria controller
 */

import { factories } from '@strapi/strapi'

/**
 * Resuelve restauranteId (numérico o documentId) al id numérico del restaurante.
 * Necesario para que entityService.create persista correctamente la relación
 */
async function resolveRestaurantId(strapi: any, restauranteId: number | string): Promise<number | null> {
  if (restauranteId == null) return null;
  if (typeof restauranteId === 'number' && Number.isFinite(restauranteId) && restauranteId > 0) {
    const r = await strapi.db.query('api::restaurante.restaurante').findOne({
      where: { id: restauranteId },
      select: ['id'],
    });
    return r?.id ?? null;
  }
  const str = String(restauranteId).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    const r = await strapi.db.query('api::restaurante.restaurante').findOne({
      where: { id: num },
      select: ['id'],
    });
    return r?.id ?? null;
  }
  const [byDoc] = await strapi.db.query('api::restaurante.restaurante').findMany({
    where: { documentId: str },
    select: ['id'],
    limit: 1,
  });
  return byDoc?.id ?? null;
}

/**
 * Helper para validar que el usuario tiene acceso al restaurante
 */
async function validateRestaurantAccess(strapi: any, userId: number, restauranteId: number | string): Promise<boolean> {
  if (!userId || !restauranteId) {
    console.log('❌ [validateRestaurantAccess] Missing userId or restauranteId:', { userId, restauranteId });
    return false;
  }

  console.log('🔍 [validateRestaurantAccess] Iniciando validación', { userId, restauranteId, type: typeof restauranteId });

  // Primero, obtener el restaurante real (puede ser por id numérico o documentId)
  let restaurant: any = null;
  
  // Intentar buscar por id numérico primero
  if (typeof restauranteId === 'number' || (typeof restauranteId === 'string' && /^\d+$/.test(restauranteId))) {
    const numId = typeof restauranteId === 'string' ? Number(restauranteId) : restauranteId;
    restaurant = await strapi.entityService.findOne('api::restaurante.restaurante', numId, {
      fields: ['id'],
    });
    console.log('🔍 [validateRestaurantAccess] Buscado por id numérico:', numId, 'Resultado:', restaurant?.id);
  }

  // Si no se encontró y es string, intentar por documentId
  if (!restaurant && typeof restauranteId === 'string') {
    const [restaurantByDocId] = await strapi.db.query('api::restaurante.restaurante').findMany({
      where: { documentId: restauranteId },
      select: ['id'],
      limit: 1,
    });
    if (restaurantByDocId) {
      restaurant = restaurantByDocId;
      console.log('🔍 [validateRestaurantAccess] Encontrado por documentId:', restauranteId, 'id:', restaurant.id);
    }
  }

  // Si aún no se encontró, intentar buscar directamente por el valor como string en documentId
  if (!restaurant && typeof restauranteId === 'string') {
    // Último intento: buscar directamente en entityService con el string
    try {
      const found = await strapi.entityService.findMany('api::restaurante.restaurante', {
        filters: {
          $or: [
            { id: { $eq: restauranteId } },
            { documentId: { $eq: restauranteId } }
          ]
        },
        fields: ['id'],
        limit: 1,
      });
      if (found?.[0]) {
        restaurant = found[0];
        console.log('🔍 [validateRestaurantAccess] Encontrado por búsqueda amplia:', restauranteId);
      }
    } catch (err) {
      console.log('⚠️ [validateRestaurantAccess] Error en búsqueda amplia:', err);
    }
  }

  if (!restaurant?.id) {
    console.log('❌ [validateRestaurantAccess] Restaurante no encontrado para:', restauranteId);
    return false;
  }

  const finalRestaurantId = restaurant.id;
  console.log('🔍 [validateRestaurantAccess] ID final del restaurante:', finalRestaurantId);

  // Buscar membership del usuario para este restaurante
  const [membership] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
    where: {
      restaurante: { id: finalRestaurantId },
      users_permissions_user: { id: userId },
      role: { $in: ['owner', 'staff'] },
      active: true,
    },
    populate: { 
      restaurante: { select: ['id', 'documentId', 'slug'] },
      users_permissions_user: { select: ['id', 'username'] }
    },
    select: ['id', 'role'],
    limit: 1,
  });

  const hasAccess = !!membership;
  console.log('🔍 [validateRestaurantAccess] Resultado final', {
    userId,
    restauranteId,
    finalRestaurantId,
    hasAccess,
    membershipId: membership?.id,
    membershipRole: membership?.role
  });

  if (!hasAccess) {
    // Log adicional para debugging: verificar si el usuario tiene alguna membresía
    const [allMemberships] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
      where: {
        users_permissions_user: { id: userId },
        active: true,
      },
      populate: { restaurante: { select: ['id', 'slug'] } },
      select: ['id', 'role'],
      limit: 10,
    });
    console.log('🔍 [validateRestaurantAccess] Membresías del usuario:', allMemberships?.map(m => ({
      id: m.id,
      role: m.role,
      restauranteId: m.restaurante?.id,
      restauranteSlug: m.restaurante?.slug
    })));
  }

  return hasAccess;
}

/**
 * Helper para resolver el ID numérico real de una categoría
 * Puede recibir un ID numérico o un documentId (string UUID)
 */
async function resolveCategoryId(strapi: any, categoryId: number | string): Promise<number | null> {
  if (!categoryId) {
    console.log('❌ [resolveCategoryId] categoryId es null o undefined');
    return null;
  }

  const param = String(categoryId).trim();
  console.log('🔍 [resolveCategoryId] Resolviendo ID', { original: categoryId, param, type: typeof categoryId });
  
  // Primero intentar buscar por documentId (más común en Strapi v5)
  // Un documentId es un UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  
  if (isUUID || param.length > 10) {
    // Parece ser un documentId (UUID), buscar por documentId primero
    try {
      console.log('🔍 [resolveCategoryId] Intentando buscar por documentId (UUID):', param);
      const byDocument = await strapi.db.query('api::categoria.categoria').findOne({
        where: { documentId: param },
        select: ['id', 'documentId'],
      });
      if (byDocument?.id) {
        console.log('✅ [resolveCategoryId] Encontrado por documentId:', param, '-> id:', byDocument.id);
        return byDocument.id;
      } else {
        console.log('⚠️ [resolveCategoryId] No se encontró categoría con documentId:', param);
      }
    } catch (err: any) {
      console.log('⚠️ [resolveCategoryId] Error buscando por documentId:', err?.message || err);
    }
  }
  
  // Si es un número válido, intentar usarlo directamente
  const maybeNumber = Number(param);
  if (Number.isFinite(maybeNumber) && maybeNumber > 0 && !isNaN(maybeNumber)) {
    try {
      console.log('🔍 [resolveCategoryId] Intentando buscar por ID numérico:', maybeNumber);
      const existing = await strapi.entityService.findOne('api::categoria.categoria', maybeNumber, {
        fields: ['id', 'documentId'],
        publicationState: 'preview', // Incluir drafts también
      });
      if (existing?.id) {
        console.log('✅ [resolveCategoryId] Encontrado por ID numérico:', maybeNumber, 'documentId:', existing.documentId);
        return existing.id;
      } else {
        console.log('⚠️ [resolveCategoryId] No se encontró categoría con ID numérico:', maybeNumber);
      }
    } catch (err: any) {
      console.log('⚠️ [resolveCategoryId] Error buscando por ID numérico:', err?.message || err);
    }
  }

  // Último intento: búsqueda amplia con filters
  try {
    console.log('🔍 [resolveCategoryId] Último intento: búsqueda amplia con filters');
    const found = await strapi.entityService.findMany('api::categoria.categoria', {
      filters: {
        $or: [
          ...(Number.isFinite(maybeNumber) && maybeNumber > 0 ? [{ id: { $eq: maybeNumber } }] : []),
          { documentId: { $eq: param } }
        ]
      },
      fields: ['id', 'documentId'],
      publicationState: 'preview',
      limit: 1,
    });
    if (found?.[0]?.id) {
      console.log('✅ [resolveCategoryId] Encontrado en búsqueda amplia:', found[0].id);
      return found[0].id;
    }
  } catch (err: any) {
    console.log('⚠️ [resolveCategoryId] Error en búsqueda amplia:', err?.message || err);
  }

  console.log('❌ [resolveCategoryId] Categoría no encontrada para:', categoryId);
  return null;
}

/**
 * Helper para obtener el restaurante de una categoría
 */
async function getCategoryRestaurant(strapi: any, categoryId: number | string): Promise<number | null> {
  const realId = await resolveCategoryId(strapi, categoryId);
  if (!realId) {
    console.log('❌ [getCategoryRestaurant] No se pudo resolver el ID de la categoría:', categoryId);
    return null;
  }

  console.log('🔍 [getCategoryRestaurant] Buscando categoría con ID:', realId);
  
  // Intentar obtener la categoría con populate de restaurante
  let category = await strapi.entityService.findOne('api::categoria.categoria', realId, {
    fields: ['id'],
    populate: { restaurante: { fields: ['id'] } },
    publicationState: 'preview', // Incluir drafts también
  });

  console.log('🔍 [getCategoryRestaurant] Categoría encontrada:', {
    hasCategory: !!category,
    categoryKeys: category ? Object.keys(category) : [],
    restaurante: category?.restaurante,
    restauranteType: typeof category?.restaurante
  });

  if (!category) {
    console.log('❌ [getCategoryRestaurant] Categoría no encontrada:', categoryId);
    return null;
  }
  
  // Intentar obtener el restaurante de diferentes formas
  let restauranteId = null;
  
  // Forma 1: restaurante directo
  if (category.restaurante) {
    if (typeof category.restaurante === 'number') {
      restauranteId = category.restaurante;
    } else if (category.restaurante.id) {
      restauranteId = category.restaurante.id;
    } else if (category.restaurante.data?.id) {
      restauranteId = category.restaurante.data.id;
    } else if (category.restaurante.data) {
      restauranteId = category.restaurante.data;
    }
  }
  
  // Si no se encontró, intentar buscar directamente en la base de datos
  if (!restauranteId) {
    console.log('🔍 [getCategoryRestaurant] Restaurante no encontrado en populate, buscando en DB');
    try {
      const categoryFromDb = await strapi.db.query('api::categoria.categoria').findOne({
        where: { id: realId },
        select: ['id'],
        populate: { restaurante: { select: ['id'] } },
      });
      
      if (categoryFromDb?.restaurante) {
        if (typeof categoryFromDb.restaurante === 'number') {
          restauranteId = categoryFromDb.restaurante;
        } else if (categoryFromDb.restaurante.id) {
          restauranteId = categoryFromDb.restaurante.id;
        }
      }
    } catch (err: any) {
      console.log('⚠️ [getCategoryRestaurant] Error buscando en DB:', err?.message);
    }
  }
  
  console.log('🔍 [getCategoryRestaurant] Resultado final', { categoryId, realId, restauranteId });
  return restauranteId;
}

export default factories.createCoreController('api::categoria.categoria', ({ strapi }) => ({
  /**
   * POST /api/categorias
   * Crea una categoría validando que el usuario tenga acceso al restaurante
   */
  async create(ctx: any) {
    const user = ctx.state?.user;
    if (!user) {
      console.log('❌ [categoria.create] Usuario no autenticado');
      ctx.unauthorized('Usuario no autenticado');
      return;
    }

    const payload = ctx.request?.body?.data || ctx.request?.body || {};
    const restauranteId = payload.restaurante;

    console.log('🔍 [categoria.create] Iniciando creación de categoría', {
      userId: user.id,
      restauranteId,
      payload: { name: payload.name, slug: payload.slug }
    });

    if (!restauranteId) {
      console.log('❌ [categoria.create] Restaurante no especificado en payload');
      ctx.badRequest('Restaurante es requerido');
      return;
    }

    // Validar que el usuario tiene acceso a este restaurante
    const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
    if (!hasAccess) {
      console.log('❌ [categoria.create] Usuario no tiene acceso al restaurante', {
        userId: user.id,
        restauranteId
      });
      ctx.forbidden('No tienes acceso a este restaurante');
      return;
    }

    // Resolver al id numérico del restaurante para que la relación se persista correctamente
    const numericRestauranteId = await resolveRestaurantId(strapi, restauranteId);
    if (numericRestauranteId == null) {
      console.log('❌ [categoria.create] No se pudo resolver el id del restaurante:', restauranteId);
      ctx.badRequest('Restaurante no encontrado');
      return;
    }

    // Crear la categoría con restaurante asociado (probar ambos formatos para compatibilidad Strapi 4/5)
    try {
      const data: Record<string, unknown> = {
        name: payload.name,
        slug: payload.slug ?? (typeof payload.name === 'string' ? payload.name.toLowerCase().replace(/\s+/g, '-') : 'categoria'),
        restaurante: numericRestauranteId,
      };
      console.log('✅ [categoria.create] Creando categoría con data:', data);
      const created = await strapi.entityService.create('api::categoria.categoria', {
        data,
        publicationState: 'live',
      });

      // Forzar relación en BD (Strapi 5 a veces no persiste manyToOne con entityService.create)
      const knex = strapi?.db?.connection;
      if (knex && created?.id != null) {
        try {
          const tableName = 'categorias';
          const hasRestauranteId = await knex.schema.hasColumn(tableName, 'restaurante_id');
          if (hasRestauranteId) {
            await knex(tableName).where({ id: created.id }).update({ restaurante_id: numericRestauranteId });
            console.log('✅ [categoria.create] Relación restaurante forzada en BD:', created.id, '->', numericRestauranteId);
          }
        } catch (knexErr: any) {
          console.warn('⚠️ [categoria.create] Knex update restaurante_id:', knexErr?.message);
        }
      }

      console.log('✅ [categoria.create] Categoría creada exitosamente ✅:', created?.id, 'restaurante:', numericRestauranteId);
      ctx.body = { data: created };
    } catch (error: any) {
      console.error('❌ [categoria.create] Error al crear categoría:', error);
      console.error('❌ [categoria.create] Error details:', error?.message, error?.stack);
      ctx.badRequest(error?.message || 'Error al crear la categoría');
    }
  },

  /**
   * PUT /api/categorias/:id
   * Actualiza una categoría validando que el usuario tenga acceso al restaurante
   */
  async update(ctx: any) {
    const user = ctx.state?.user;
    if (!user) {
      ctx.unauthorized('Usuario no autenticado');
      return;
    }

    const categoryId = ctx.params?.id;
    if (!categoryId) {
      ctx.badRequest('ID de categoría requerido');
      return;
    }

    // Resolver el ID real (puede ser numérico o documentId)
    const realId = await resolveCategoryId(strapi, categoryId);
    if (!realId) {
      ctx.notFound('Categoría no encontrada');
      return;
    }

    // Obtener el restaurante de la categoría existente
    const restauranteId = await getCategoryRestaurant(strapi, realId);
    if (!restauranteId) {
      ctx.notFound('Categoría no encontrada');
      return;
    }

    // Validar que el usuario tiene acceso a este restaurante
    const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
    if (!hasAccess) {
      ctx.forbidden('No tienes acceso a este restaurante');
      return;
    }

    const payload = ctx.request?.body?.data || ctx.request?.body || {};

    // Si se intenta cambiar el restaurante, validar acceso al nuevo restaurante también
    if (payload.restaurante && payload.restaurante !== restauranteId) {
      const hasNewAccess = await validateRestaurantAccess(strapi, user.id, payload.restaurante);
      if (!hasNewAccess) {
        ctx.forbidden('No tienes acceso al restaurante especificado');
        return;
      }
    }

    try {
      const updated = await strapi.entityService.update('api::categoria.categoria', realId, {
        data: payload,
      });

      ctx.body = { data: updated };
    } catch (error: any) {
      console.error('Error updating category:', error);
      ctx.badRequest(error?.message || 'Error al actualizar la categoría');
    }
  },

  /**
   * DELETE /api/categorias/:id
   * Elimina una categoría validando que el usuario tenga acceso al restaurante
   */
  async delete(ctx: any) {
    console.log('🚀 [categoria.delete] Método delete llamado');
    console.log('🚀 [categoria.delete] ctx.params:', ctx.params);
    console.log('🚀 [categoria.delete] ctx.state:', { 
      user: ctx.state?.user?.id,
      hasUser: !!ctx.state?.user 
    });
    
    const user = ctx.state?.user;
    if (!user) {
      console.log('❌ [categoria.delete] Usuario no autenticado');
      ctx.unauthorized('Usuario no autenticado');
      return;
    }

    const categoryId = ctx.params?.id;
    console.log('🔍 [categoria.delete] Iniciando eliminación', {
      categoryId,
      userId: user.id,
      type: typeof categoryId,
      paramsKeys: Object.keys(ctx.params || {}),
      fullParams: ctx.params
    });

    if (!categoryId) {
      console.log('❌ [categoria.delete] ID de categoría no proporcionado');
      ctx.badRequest('ID de categoría requerido');
      return;
    }

    // Resolver el ID real (puede ser numérico o documentId)
    const realId = await resolveCategoryId(strapi, categoryId);
    console.log('🔍 [categoria.delete] ID resuelto', { categoryId, realId });
    
    if (!realId) {
      console.log('❌ [categoria.delete] No se pudo resolver el ID de la categoría');
      ctx.notFound('Categoría no encontrada');
      return;
    }

    // Obtener el restaurante de la categoría existente
    const restauranteId = await getCategoryRestaurant(strapi, realId);
    console.log('🔍 [categoria.delete] Restaurante obtenido', { realId, restauranteId });
    
    if (!restauranteId) {
      console.log('❌ [categoria.delete] No se pudo obtener el restaurante de la categoría');
      ctx.notFound('Categoría no encontrada');
      return;
    }

    // Validar que el usuario tiene acceso a este restaurante
    const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
    console.log('🔍 [categoria.delete] Validación de acceso', { userId: user.id, restauranteId, hasAccess });
    
    if (!hasAccess) {
      console.log('❌ [categoria.delete] Usuario no tiene acceso al restaurante');
      ctx.forbidden('No tienes acceso a este restaurante');
      return;
    }

    try {
      console.log('✅ [categoria.delete] Eliminando categoría con ID:', realId);
      
      // Verificar que la categoría existe antes de intentar eliminarla
      const categoryExists = await strapi.entityService.findOne('api::categoria.categoria', realId, {
        fields: ['id'],
        publicationState: 'preview',
      });
      
      if (!categoryExists) {
        console.log('❌ [categoria.delete] Categoría no existe con ID:', realId);
        ctx.notFound('Categoría no encontrada');
        return;
      }
      
      const deleted = await strapi.entityService.delete('api::categoria.categoria', realId);
      console.log('✅ [categoria.delete] Categoría eliminada exitosamente');
      ctx.body = { data: deleted };
    } catch (error: any) {
      console.error('❌ [categoria.delete] Error al eliminar categoría:', error);
      console.error('❌ [categoria.delete] Error message:', error?.message);
      console.error('❌ [categoria.delete] Error stack:', error?.stack);
      console.error('❌ [categoria.delete] Error name:', error?.name);
      console.error('❌ [categoria.delete] Error code:', error?.code);
      
      // Si es un error 404 de Strapi, devolver notFound
      if (error?.status === 404 || error?.message?.includes('not found') || error?.message?.includes('Not Found')) {
        ctx.notFound('Categoría no encontrada');
        return;
      }
      
      ctx.badRequest(error?.message || 'Error al eliminar la categoría');
    }
  },
}));
