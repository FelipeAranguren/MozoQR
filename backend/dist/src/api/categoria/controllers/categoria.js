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
 * Helper para resolver el ID numérico real de una categoría
 * Puede recibir un ID numérico o un documentId (string UUID)
 */
async function resolveCategoryId(strapi, categoryId) {
    var _a;
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
            if (byDocument === null || byDocument === void 0 ? void 0 : byDocument.id) {
                console.log('✅ [resolveCategoryId] Encontrado por documentId:', param, '-> id:', byDocument.id);
                return byDocument.id;
            }
            else {
                console.log('⚠️ [resolveCategoryId] No se encontró categoría con documentId:', param);
            }
        }
        catch (err) {
            console.log('⚠️ [resolveCategoryId] Error buscando por documentId:', (err === null || err === void 0 ? void 0 : err.message) || err);
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
            if (existing === null || existing === void 0 ? void 0 : existing.id) {
                console.log('✅ [resolveCategoryId] Encontrado por ID numérico:', maybeNumber, 'documentId:', existing.documentId);
                return existing.id;
            }
            else {
                console.log('⚠️ [resolveCategoryId] No se encontró categoría con ID numérico:', maybeNumber);
            }
        }
        catch (err) {
            console.log('⚠️ [resolveCategoryId] Error buscando por ID numérico:', (err === null || err === void 0 ? void 0 : err.message) || err);
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
        if ((_a = found === null || found === void 0 ? void 0 : found[0]) === null || _a === void 0 ? void 0 : _a.id) {
            console.log('✅ [resolveCategoryId] Encontrado en búsqueda amplia:', found[0].id);
            return found[0].id;
        }
    }
    catch (err) {
        console.log('⚠️ [resolveCategoryId] Error en búsqueda amplia:', (err === null || err === void 0 ? void 0 : err.message) || err);
    }
    console.log('❌ [resolveCategoryId] Categoría no encontrada para:', categoryId);
    return null;
}
/**
 * Helper para obtener el restaurante de una categoría
 */
async function getCategoryRestaurant(strapi, categoryId) {
    var _a;
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
        restaurante: category === null || category === void 0 ? void 0 : category.restaurante,
        restauranteType: typeof (category === null || category === void 0 ? void 0 : category.restaurante)
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
        }
        else if (category.restaurante.id) {
            restauranteId = category.restaurante.id;
        }
        else if ((_a = category.restaurante.data) === null || _a === void 0 ? void 0 : _a.id) {
            restauranteId = category.restaurante.data.id;
        }
        else if (category.restaurante.data) {
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
            if (categoryFromDb === null || categoryFromDb === void 0 ? void 0 : categoryFromDb.restaurante) {
                if (typeof categoryFromDb.restaurante === 'number') {
                    restauranteId = categoryFromDb.restaurante;
                }
                else if (categoryFromDb.restaurante.id) {
                    restauranteId = categoryFromDb.restaurante.id;
                }
            }
        }
        catch (err) {
            console.log('⚠️ [getCategoryRestaurant] Error buscando en DB:', err === null || err === void 0 ? void 0 : err.message);
        }
    }
    console.log('🔍 [getCategoryRestaurant] Resultado final', { categoryId, realId, restauranteId });
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
            const updated = await strapi.entityService.update('api::categoria.categoria', realId, {
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
        var _a, _b, _c, _d, _e, _f, _g;
        console.log('🚀 [categoria.delete] Método delete llamado');
        console.log('🚀 [categoria.delete] ctx.params:', ctx.params);
        console.log('🚀 [categoria.delete] ctx.state:', {
            user: (_b = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id,
            hasUser: !!((_c = ctx.state) === null || _c === void 0 ? void 0 : _c.user)
        });
        const user = (_d = ctx.state) === null || _d === void 0 ? void 0 : _d.user;
        if (!user) {
            console.log('❌ [categoria.delete] Usuario no autenticado');
            ctx.unauthorized('Usuario no autenticado');
            return;
        }
        const categoryId = (_e = ctx.params) === null || _e === void 0 ? void 0 : _e.id;
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
        }
        catch (error) {
            console.error('❌ [categoria.delete] Error al eliminar categoría:', error);
            console.error('❌ [categoria.delete] Error message:', error === null || error === void 0 ? void 0 : error.message);
            console.error('❌ [categoria.delete] Error stack:', error === null || error === void 0 ? void 0 : error.stack);
            console.error('❌ [categoria.delete] Error name:', error === null || error === void 0 ? void 0 : error.name);
            console.error('❌ [categoria.delete] Error code:', error === null || error === void 0 ? void 0 : error.code);
            // Si es un error 404 de Strapi, devolver notFound
            if ((error === null || error === void 0 ? void 0 : error.status) === 404 || ((_f = error === null || error === void 0 ? void 0 : error.message) === null || _f === void 0 ? void 0 : _f.includes('not found')) || ((_g = error === null || error === void 0 ? void 0 : error.message) === null || _g === void 0 ? void 0 : _g.includes('Not Found'))) {
                ctx.notFound('Categoría no encontrada');
                return;
            }
            ctx.badRequest((error === null || error === void 0 ? void 0 : error.message) || 'Error al eliminar la categoría');
        }
    },
}));
