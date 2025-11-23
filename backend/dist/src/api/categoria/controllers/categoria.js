"use strict";
/**
 * categoria controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
/**
 * Helper para validar que el usuario tiene acceso al restaurante
 */
async function validateRestaurantAccess(strapi, userId, restauranteId) {
    if (!userId || !restauranteId) {
        console.log('❌ [validateRestaurantAccess] Missing userId or restauranteId:', { userId, restauranteId });
        return false;
    }
    console.log('🔍 [validateRestaurantAccess] Iniciando validación', { userId, restauranteId, type: typeof restauranteId });
    // Primero, obtener el restaurante real (puede ser por id numérico o documentId)
    let restaurant = null;
    // Intentar buscar por id numérico primero
    if (typeof restauranteId === 'number' || (typeof restauranteId === 'string' && /^\d+$/.test(restauranteId))) {
        const numId = typeof restauranteId === 'string' ? Number(restauranteId) : restauranteId;
        restaurant = await strapi.entityService.findOne('api::restaurante.restaurante', numId, {
            fields: ['id'],
        });
        console.log('🔍 [validateRestaurantAccess] Buscado por id numérico:', numId, 'Resultado:', restaurant === null || restaurant === void 0 ? void 0 : restaurant.id);
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
            if (found === null || found === void 0 ? void 0 : found[0]) {
                restaurant = found[0];
                console.log('🔍 [validateRestaurantAccess] Encontrado por búsqueda amplia:', restauranteId);
            }
        }
        catch (err) {
            console.log('⚠️ [validateRestaurantAccess] Error en búsqueda amplia:', err);
        }
    }
    if (!(restaurant === null || restaurant === void 0 ? void 0 : restaurant.id)) {
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
        membershipId: membership === null || membership === void 0 ? void 0 : membership.id,
        membershipRole: membership === null || membership === void 0 ? void 0 : membership.role
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
        console.log('🔍 [validateRestaurantAccess] Membresías del usuario:', allMemberships === null || allMemberships === void 0 ? void 0 : allMemberships.map(m => {
            var _a, _b;
            return ({
                id: m.id,
                role: m.role,
                restauranteId: (_a = m.restaurante) === null || _a === void 0 ? void 0 : _a.id,
                restauranteSlug: (_b = m.restaurante) === null || _b === void 0 ? void 0 : _b.slug
            });
        }));
    }
    return hasAccess;
}
/**
 * Helper para obtener el restaurante de una categoría
 */
async function getCategoryRestaurant(strapi, categoryId) {
    var _a;
    // Normalizar categoryId
    const normalizedId = typeof categoryId === 'string' && /^\d+$/.test(categoryId)
        ? Number(categoryId)
        : categoryId;
    const category = await strapi.entityService.findOne('api::categoria.categoria', normalizedId, {
        fields: ['id'],
        populate: { restaurante: { fields: ['id'] } },
    });
    if (!category) {
        console.log('❌ [getCategoryRestaurant] Categoría no encontrada:', categoryId);
        return null;
    }
    const restaurante = ((_a = category.restaurante) === null || _a === void 0 ? void 0 : _a.data) || category.restaurante;
    const restauranteId = (restaurante === null || restaurante === void 0 ? void 0 : restaurante.id) || null;
    console.log('🔍 [getCategoryRestaurant]', { categoryId, restauranteId });
    return restauranteId;
}
exports.default = strapi_1.factories.createCoreController('api::categoria.categoria', ({ strapi }) => ({
    /**
     * POST /api/categorias
     * Crea una categoría validando que el usuario tenga acceso al restaurante
     */
    async create(ctx) {
        var _a, _b, _c, _d;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            console.log('❌ [categoria.create] Usuario no autenticado');
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
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
        // Crear la categoría
        try {
            console.log('✅ [categoria.create] Creando categoría con payload:', payload);
            const created = await strapi.entityService.create('api::categoria.categoria', {
                data: payload,
            });
            console.log('✅ [categoria.create] Categoría creada exitosamente:', created === null || created === void 0 ? void 0 : created.id);
            ctx.body = { data: created };
        }
        catch (error) {
            console.error('❌ [categoria.create] Error al crear categoría:', error);
            console.error('❌ [categoria.create] Error details:', error === null || error === void 0 ? void 0 : error.message, error === null || error === void 0 ? void 0 : error.stack);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al crear la categoría');
        }
    },
    /**
     * PUT /api/categorias/:id
     * Actualiza una categoría validando que el usuario tenga acceso al restaurante
     */
    async update(ctx) {
        var _a, _b, _c, _d, _e;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const categoryId = (_b = ctx.params) === null || _b === void 0 ? void 0 : _b.id;
        if (!categoryId) {
            ctx.badRequest('ID de categoría requerido');
            return;
        }
        // Obtener el restaurante de la categoría existente
        const restauranteId = await getCategoryRestaurant(strapi, Number(categoryId));
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
        const payload = ((_d = (_c = ctx.request) === null || _c === void 0 ? void 0 : _c.body) === null || _d === void 0 ? void 0 : _d.data) || ((_e = ctx.request) === null || _e === void 0 ? void 0 : _e.body) || {};
        // Si se intenta cambiar el restaurante, validar acceso al nuevo restaurante también
        if (payload.restaurante && payload.restaurante !== restauranteId) {
            const hasNewAccess = await validateRestaurantAccess(strapi, user.id, payload.restaurante);
            if (!hasNewAccess) {
                ctx.forbidden('No tienes acceso al restaurante especificado');
                return;
            }
        }
        try {
            const updated = await strapi.entityService.update('api::categoria.categoria', Number(categoryId), {
                data: payload,
            });
            ctx.body = { data: updated };
        }
        catch (error) {
            console.error('Error updating category:', error);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al actualizar la categoría');
        }
    },
    /**
     * DELETE /api/categorias/:id
     * Elimina una categoría validando que el usuario tenga acceso al restaurante
     */
    async delete(ctx) {
        var _a, _b;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const categoryId = (_b = ctx.params) === null || _b === void 0 ? void 0 : _b.id;
        if (!categoryId) {
            ctx.badRequest('ID de categoría requerido');
            return;
        }
        // Obtener el restaurante de la categoría existente
        const restauranteId = await getCategoryRestaurant(strapi, Number(categoryId));
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
        try {
            const deleted = await strapi.entityService.delete('api::categoria.categoria', Number(categoryId));
            ctx.body = { data: deleted };
        }
        catch (error) {
            console.error('Error deleting category:', error);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al eliminar la categoría');
        }
    },
}));
