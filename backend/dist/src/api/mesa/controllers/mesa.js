"use strict";
/**
 * mesa controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
/**
 * Helper para validar que el usuario tiene acceso al restaurante
 */
async function validateRestaurantAccess(strapi, userId, restauranteId) {
    if (!userId || !restauranteId) {
        console.log('❌ [mesa.validateRestaurantAccess] Missing userId or restauranteId:', { userId, restauranteId });
        return false;
    }
    console.log('🔍 [mesa.validateRestaurantAccess] Iniciando validación', { userId, restauranteId, type: typeof restauranteId });
    // Primero, obtener el restaurante real (puede ser por id numérico o documentId)
    let restaurant = null;
    // Intentar buscar por id numérico primero
    if (typeof restauranteId === 'number' || (typeof restauranteId === 'string' && /^\d+$/.test(restauranteId))) {
        const numId = typeof restauranteId === 'string' ? Number(restauranteId) : restauranteId;
        restaurant = await strapi.entityService.findOne('api::restaurante.restaurante', numId, {
            fields: ['id'],
        });
        console.log('🔍 [mesa.validateRestaurantAccess] Buscado por id numérico:', numId, 'Resultado:', restaurant === null || restaurant === void 0 ? void 0 : restaurant.id);
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
            console.log('🔍 [mesa.validateRestaurantAccess] Encontrado por documentId:', restauranteId, 'id:', restaurant.id);
        }
    }
    // Si aún no se encontró, intentar buscar directamente por el valor como string
    if (!restaurant && typeof restauranteId === 'string') {
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
                console.log('🔍 [mesa.validateRestaurantAccess] Encontrado por búsqueda amplia:', restauranteId);
            }
        }
        catch (err) {
            console.log('⚠️ [mesa.validateRestaurantAccess] Error en búsqueda amplia:', err);
        }
    }
    if (!(restaurant === null || restaurant === void 0 ? void 0 : restaurant.id)) {
        console.log('❌ [mesa.validateRestaurantAccess] Restaurante no encontrado para:', restauranteId);
        return false;
    }
    const finalRestaurantId = restaurant.id;
    console.log('🔍 [mesa.validateRestaurantAccess] ID final del restaurante:', finalRestaurantId);
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
    console.log('🔍 [mesa.validateRestaurantAccess] Resultado final', {
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
        console.log('🔍 [mesa.validateRestaurantAccess] Membresías del usuario:', allMemberships === null || allMemberships === void 0 ? void 0 : allMemberships.map(m => {
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
exports.default = strapi_1.factories.createCoreController('api::mesa.mesa', ({ strapi }) => ({
    /**
     * POST /api/mesas
     * Crea una mesa validando que el usuario tenga acceso al restaurante
     */
    async create(ctx) {
        var _a, _b, _c, _d;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            console.log('❌ [mesa.create] Usuario no autenticado');
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
        const restauranteId = payload.restaurante;
        console.log('🔍 [mesa.create] Iniciando creación de mesa', {
            userId: user.id,
            restauranteId,
            payload: { number: payload.number, name: payload.name }
        });
        if (!restauranteId) {
            console.log('❌ [mesa.create] Restaurante no especificado en payload');
            ctx.badRequest('Restaurante es requerido');
            return;
        }
        // Validar que el usuario tiene acceso a este restaurante
        const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
        if (!hasAccess) {
            console.log('❌ [mesa.create] Usuario no tiene acceso al restaurante', {
                userId: user.id,
                restauranteId
            });
            ctx.forbidden('No tienes acceso a este restaurante');
            return;
        }
        // Crear la mesa
        try {
            console.log('✅ [mesa.create] Creando mesa con payload:', payload);
            const created = await strapi.entityService.create('api::mesa.mesa', {
                data: {
                    ...payload,
                    publishedAt: payload.publishedAt || new Date().toISOString(),
                },
            });
            console.log('✅ [mesa.create] Mesa creada exitosamente:', created === null || created === void 0 ? void 0 : created.id);
            ctx.body = { data: created };
        }
        catch (error) {
            console.error('❌ [mesa.create] Error al crear mesa:', error);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al crear la mesa');
        }
    },
    /**
     * PUT /api/mesas/:id
     * Actualiza una mesa validando que el usuario tenga acceso al restaurante
     */
    async update(ctx) {
        var _a, _b, _c, _d, _e;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const { id } = ctx.params;
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
        // Obtener la mesa existente para validar el restaurante
        const [existingMesa] = await strapi.db.query('api::mesa.mesa').findMany({
            where: { id },
            populate: { restaurante: { select: ['id'] } },
            select: ['id'],
            limit: 1,
        });
        if (!existingMesa) {
            ctx.notFound('Mesa no encontrada');
            return;
        }
        const existingRestauranteId = (_e = existingMesa.restaurante) === null || _e === void 0 ? void 0 : _e.id;
        const restauranteId = payload.restaurante || existingRestauranteId;
        if (!restauranteId) {
            ctx.badRequest('Restaurante es requerido');
            return;
        }
        // Validar acceso
        const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
        if (!hasAccess) {
            ctx.forbidden('No tienes acceso a este restaurante');
            return;
        }
        try {
            const updated = await strapi.entityService.update('api::mesa.mesa', id, {
                data: payload,
            });
            ctx.body = { data: updated };
        }
        catch (error) {
            console.error('Error al actualizar mesa:', error);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al actualizar la mesa');
        }
    },
    /**
     * DELETE /api/mesas/:id
     * Elimina una mesa validando que el usuario tenga acceso al restaurante
     */
    async delete(ctx) {
        var _a, _b;
        const user = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        if (!user) {
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const { id } = ctx.params;
        // Obtener la mesa existente para validar el restaurante
        const [existingMesa] = await strapi.db.query('api::mesa.mesa').findMany({
            where: { id },
            populate: { restaurante: { select: ['id'] } },
            select: ['id'],
            limit: 1,
        });
        if (!existingMesa) {
            ctx.notFound('Mesa no encontrada');
            return;
        }
        const restauranteId = (_b = existingMesa.restaurante) === null || _b === void 0 ? void 0 : _b.id;
        if (!restauranteId) {
            ctx.badRequest('Restaurante no encontrado en la mesa');
            return;
        }
        // Validar acceso
        const hasAccess = await validateRestaurantAccess(strapi, user.id, restauranteId);
        if (!hasAccess) {
            ctx.forbidden('No tienes acceso a este restaurante');
            return;
        }
        try {
            await strapi.entityService.delete('api::mesa.mesa', id);
            ctx.body = { data: { id } };
        }
        catch (error) {
            console.error('Error al eliminar mesa:', error);
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al eliminar la mesa');
        }
    },
}));
