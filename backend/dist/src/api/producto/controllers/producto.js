"use strict";
/**
 * producto controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
// Helper para resolver el ID real (numérico o documentId)
async function resolveProductId(strapi, param) {
    if (!param)
        return null;
    // ¿Es un número válido?
    const maybeNumber = Number(param);
    if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
        return maybeNumber;
    }
    // Tratar como documentId
    const existing = await strapi.db.query('api::producto.producto').findOne({
        where: { documentId: param },
        select: ['id'],
    });
    return (existing === null || existing === void 0 ? void 0 : existing.id) || null;
}
exports.default = strapi_1.factories.createCoreController('api::producto.producto', ({ strapi }) => ({
    /**
     * POST /api/productos
     * Crea un producto y asegura que el restaurante esté asociado
     */
    async create(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        console.log('🔍 [producto.create] Método create personalizado ejecutándose');
        console.log('🔍 [producto.create] Request body completo:', JSON.stringify((_a = ctx.request) === null || _a === void 0 ? void 0 : _a.body, null, 2));
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
        console.log('🔍 [producto.create] Payload extraído:', JSON.stringify(payload, null, 2));
        console.log('🔍 [producto.create] Restaurante en payload:', payload.restaurante, 'Tipo:', typeof payload.restaurante);
        // Validar que el restaurante esté presente
        if (!payload.restaurante) {
            console.error('❌ [producto.create] No se proporcionó restaurante en el payload');
            console.error('❌ [producto.create] Payload completo:', payload);
            ctx.badRequest('El restaurante es requerido');
            return;
        }
        // Asegurar que restaurante sea un número
        let restauranteId = Number(payload.restaurante);
        if (isNaN(restauranteId) || restauranteId <= 0) {
            console.error('❌ [producto.create] ID de restaurante inválido:', payload.restaurante);
            ctx.badRequest('ID de restaurante inválido');
            return;
        }
        // Verificar que el restaurante exista y esté publicado
        const restaurante = await strapi.db.query('api::restaurante.restaurante').findOne({
            where: { id: restauranteId },
            select: ['id', 'slug', 'publishedAt'],
        });
        if (!restaurante) {
            console.error('❌ [producto.create] Restaurante no encontrado con ID:', restauranteId);
            ctx.notFound('Restaurante no encontrado');
            return;
        }
        // Verificar si hay múltiples restaurantes con el mismo slug
        // Si es así, usar siempre el de ID más bajo (el principal)
        const allWithSameSlug = await strapi.db.query('api::restaurante.restaurante').findMany({
            where: { slug: restaurante.slug },
            select: ['id', 'slug', 'publishedAt'],
            orderBy: { id: 'asc' },
            limit: 10
        });
        if (allWithSameSlug.length > 1) {
            console.warn(`⚠️ [producto.create] Se encontraron ${allWithSameSlug.length} restaurantes con slug "${restaurante.slug}"`);
            const principalId = allWithSameSlug[0].id; // El de ID más bajo
            if (restauranteId !== principalId) {
                console.warn(`⚠️ [producto.create] El restaurante enviado (ID: ${restauranteId}) no es el principal (ID: ${principalId})`);
                console.log(`🔧 [producto.create] Corrigiendo para usar el restaurante principal: ${principalId}`);
                restauranteId = principalId;
                // Actualizar la referencia al restaurante principal
                const principalRestaurante = allWithSameSlug[0];
                if (!principalRestaurante.publishedAt) {
                    console.warn('⚠️ [producto.create] El restaurante principal no está publicado');
                }
                // Actualizar la referencia para usar el restaurante principal
                Object.assign(restaurante, principalRestaurante);
            }
        }
        if (!restaurante.publishedAt) {
            console.warn('⚠️ [producto.create] Restaurante encontrado pero no está publicado:', restauranteId);
            // Continuar de todas formas, pero advertir
        }
        console.log('✅ [producto.create] Restaurante verificado (final):', {
            id: restauranteId,
            slug: restaurante.slug,
            publishedAt: restaurante.publishedAt,
            totalWithSameSlug: allWithSameSlug.length
        });
        // Asegurar que el restaurante esté en el payload (usar el ID corregido si se cambió)
        const finalPayload = {
            ...payload,
            restaurante: restauranteId // Usar el ID corregido (principal)
        };
        console.log('🔍 [producto.create] Payload final con restaurante:', JSON.stringify(finalPayload, null, 2));
        try {
            // Crear el producto usando entityService para manejar correctamente las relaciones
            console.log('🔍 [producto.create] Llamando a entityService.create con:', JSON.stringify(finalPayload, null, 2));
            // Usar entityService.create que maneja correctamente las relaciones
            const created = await strapi.entityService.create('api::producto.producto', {
                data: {
                    ...finalPayload,
                    restaurante: restauranteId, // Asegurar que use el ID corregido
                },
                publicationState: 'live', // Publicar automáticamente
            });
            console.log('✅ [producto.create] Producto creado exitosamente:', created === null || created === void 0 ? void 0 : created.id);
            console.log('🔍 [producto.create] Producto creado completo:', JSON.stringify(created, null, 2));
            console.log('✅ [producto.create] Producto publicado automáticamente');
            // Verificar que el restaurante esté asociado usando entityService
            let verifyProduct = await strapi.entityService.findOne('api::producto.producto', created.id, {
                populate: ['restaurante'],
                fields: ['id'],
            });
            const verifyRestauranteId = ((_e = verifyProduct === null || verifyProduct === void 0 ? void 0 : verifyProduct.restaurante) === null || _e === void 0 ? void 0 : _e.id) || ((_g = (_f = verifyProduct === null || verifyProduct === void 0 ? void 0 : verifyProduct.restaurante) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.id);
            if (verifyRestauranteId !== restauranteId) {
                console.warn('⚠️ [producto.create] El producto fue creado pero el restaurante no está asociado correctamente');
                console.warn('⚠️ [producto.create] Esperado:', restauranteId, 'Obtenido:', verifyRestauranteId);
                console.log('🔧 [producto.create] Intentando asociar el restaurante usando entityService.update...');
                // Intentar asociar el restaurante usando entityService
                try {
                    await strapi.entityService.update('api::producto.producto', created.id, {
                        data: {
                            restaurante: restauranteId
                        },
                        populate: ['restaurante']
                    });
                    console.log('✅ [producto.create] Actualización de relación ejecutada, verificando...');
                    // Verificar nuevamente
                    verifyProduct = await strapi.entityService.findOne('api::producto.producto', created.id, {
                        populate: ['restaurante'],
                        fields: ['id'],
                    });
                    const verifyRestauranteIdAfter = ((_h = verifyProduct === null || verifyProduct === void 0 ? void 0 : verifyProduct.restaurante) === null || _h === void 0 ? void 0 : _h.id) || ((_k = (_j = verifyProduct === null || verifyProduct === void 0 ? void 0 : verifyProduct.restaurante) === null || _j === void 0 ? void 0 : _j.data) === null || _k === void 0 ? void 0 : _k.id);
                    if (verifyRestauranteIdAfter === restauranteId) {
                        console.log('✅ [producto.create] Restaurante asociado correctamente después de actualización');
                    }
                    else {
                        console.error('❌ [producto.create] No se pudo asociar el restaurante incluso después de actualización');
                        console.error('❌ [producto.create] Estado del producto después de actualización:', verifyProduct);
                    }
                }
                catch (updateErr) {
                    console.error('❌ [producto.create] Error al intentar asociar restaurante:', updateErr);
                    console.error('❌ [producto.create] Error details:', updateErr.message, updateErr.stack);
                }
            }
            else {
                console.log('✅ [producto.create] Restaurante asociado correctamente al producto');
            }
            // Verificar que el producto se pueda encontrar con una consulta similar a la del menú
            console.log('🔍 [producto.create] Verificando si el producto se puede encontrar con entityService (como en el menú)...');
            try {
                const testQueryLive = await strapi.entityService.findMany('api::producto.producto', {
                    filters: {
                        restaurante: { id: restauranteId },
                        id: created.id
                    },
                    publicationState: 'live',
                    limit: 1,
                });
                console.log('🔍 [producto.create] entityService.findMany (live):', (testQueryLive === null || testQueryLive === void 0 ? void 0 : testQueryLive.length) || 0, 'productos encontrados');
                if (testQueryLive && testQueryLive.length > 0) {
                    console.log('✅ [producto.create] Producto encontrado correctamente con entityService (live)');
                }
                else {
                    console.warn('⚠️ [producto.create] Producto NO encontrado con entityService (live)');
                    // Intentar con preview
                    const testQueryPreview = await strapi.entityService.findMany('api::producto.producto', {
                        filters: {
                            restaurante: { id: restauranteId },
                            id: created.id
                        },
                        publicationState: 'preview',
                        limit: 1,
                    });
                    console.log('🔍 [producto.create] entityService.findMany (preview):', (testQueryPreview === null || testQueryPreview === void 0 ? void 0 : testQueryPreview.length) || 0, 'productos encontrados');
                    if (testQueryPreview && testQueryPreview.length > 0) {
                        console.log('✅ [producto.create] Producto encontrado con entityService (preview)');
                    }
                    else {
                        console.error('❌ [producto.create] Producto NO encontrado ni en live ni en preview');
                        console.error('❌ [producto.create] Esto indica un problema con la relación restaurante o la publicación');
                    }
                }
            }
            catch (testErr) {
                console.error('❌ [producto.create] Error al verificar con entityService:', testErr);
            }
            // Obtener el producto completo con todas las relaciones para la respuesta
            const fullProduct = await strapi.entityService.findOne('api::producto.producto', created.id, {
                populate: ['restaurante', 'categoria', 'image'],
            });
            ctx.body = { data: fullProduct || created };
        }
        catch (err) {
            console.error('❌ [producto.create] Error al crear producto:', err);
            ctx.badRequest(err.message || 'Error al crear el producto');
        }
    },
    /**
     * PUT /api/productos/:id
     * - Si :id es numérico -> actualiza por id
     * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
     */
    async update(ctx) {
        var _a, _b, _c, _d;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
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
        var _a;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
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
