"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom tenant controller
 * Endpoints:
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 *  - PUT /api/restaurants/:slug/close-session
 */
const utils_1 = require("@strapi/utils");
const { ValidationError, NotFoundError } = utils_1.errors;
function getPayload(raw) {
    return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}
/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */
async function getRestaurantBySlug(slug) {
    const rows = await strapi.entityService.findMany('api::restaurante.restaurante', {
        filters: { slug },
        fields: ['id', 'documentId', 'name'],
        limit: 1,
    });
    const r = rows === null || rows === void 0 ? void 0 : rows[0];
    if (!(r === null || r === void 0 ? void 0 : r.id))
        throw new NotFoundError('Restaurante no encontrado');
    return { id: r.id, documentId: r.documentId, name: r.name };
}
/**
 * Get Table strictly by Number. Creates it if not found (with duplicate protection).
 * Uses direct DB query to avoid entityService relation filter issues.
 * PROTECCIÓN CONTRA DUPLICADOS: Verifica antes de crear y maneja race conditions.
 */
async function getMesaOrThrow(restauranteId, number) {
    const restauranteIdNum = Number(restauranteId);
    const numberNum = Number(number);
    // Validar parámetros
    if (!restauranteIdNum || isNaN(restauranteIdNum)) {
        throw new ValidationError(`ID de restaurante inválido: ${restauranteId}`);
    }
    if (!numberNum || isNaN(numberNum) || numberNum <= 0) {
        throw new ValidationError(`Número de mesa inválido: ${number}`);
    }
    // Use direct DB query for more reliable relation filtering (searches all, including unpublished)
    // Buscar todas las mesas con ese número para detectar duplicados
    let found = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
            restaurante: restauranteIdNum,
            number: numberNum
        },
        select: ['id', 'number', 'status', 'documentId'],
        orderBy: { id: 'asc' } // Ordenar por ID para consistencia
    });
    // Verificar si hay duplicados (más de una mesa con el mismo número)
    if (found.length > 1) {
        console.error(`[getMesaOrThrow] ⚠️ DUPLICADO DETECTADO: ${found.length} mesas encontradas con número ${numberNum} para restaurante ${restauranteIdNum}`);
        console.error(`[getMesaOrThrow] IDs de mesas duplicadas:`, found.map(m => m.id));
        // Usar la primera mesa encontrada (la más antigua por ID), pero loguear el error
        // TODO: En el futuro, podría implementarse una limpieza de duplicados
    }
    let mesa = found === null || found === void 0 ? void 0 : found[0];
    // Si la mesa no existe, intentar crearla (con protección robusta contra duplicados)
    if (!(mesa === null || mesa === void 0 ? void 0 : mesa.id)) {
        // Estrategia: Intentar crear, y si falla o si después de crear encontramos duplicados,
        // buscar de nuevo y usar la primera (más antigua)
        let created = false;
        try {
            // Verificar una vez más antes de crear (protección contra race conditions)
            const preCreateCheck = await strapi.db.query('api::mesa.mesa').findMany({
                where: {
                    restaurante: restauranteIdNum,
                    number: numberNum
                },
                select: ['id', 'number', 'status', 'documentId'],
                limit: 1
            });
            if (preCreateCheck.length > 0) {
                // La mesa fue creada entre búsquedas (race condition)
                mesa = preCreateCheck[0];
                console.log(`[getMesaOrThrow] Mesa ${numberNum} encontrada en verificación pre-creación (evitó duplicado)`);
            }
            else {
                // Crear la mesa solo si realmente no existe
                const newMesa = await strapi.entityService.create('api::mesa.mesa', {
                    data: {
                        number: numberNum,
                        name: `Mesa ${numberNum}`,
                        displayName: `Mesa ${numberNum}`,
                        status: 'disponible',
                        isActive: true,
                        restaurante: { id: restauranteIdNum },
                        publishedAt: new Date()
                    }
                });
                created = true;
                console.log(`[getMesaOrThrow] Mesa ${numberNum} creada automáticamente para restaurante ${restauranteIdNum}`);
                // Después de crear, verificar si hay duplicados (otro proceso pudo crear una al mismo tiempo)
                const postCreateCheck = await strapi.db.query('api::mesa.mesa').findMany({
                    where: {
                        restaurante: restauranteIdNum,
                        number: numberNum
                    },
                    select: ['id', 'number', 'status', 'documentId'],
                    orderBy: { id: 'asc' }
                });
                if (postCreateCheck.length > 1) {
                    // Se creó un duplicado - usar la primera (más antigua) y loguear
                    console.error(`[getMesaOrThrow] ⚠️ DUPLICADO CREADO: Se detectaron ${postCreateCheck.length} mesas después de crear. Usando la más antigua.`);
                    console.error(`[getMesaOrThrow] IDs:`, postCreateCheck.map(m => m.id));
                    mesa = postCreateCheck[0]; // Usar la primera (más antigua)
                }
                else {
                    mesa = {
                        id: newMesa.id,
                        number: newMesa.number || numberNum,
                        status: newMesa.status || 'disponible',
                        documentId: newMesa.documentId
                    };
                }
            }
        }
        catch (createErr) {
            // Si falla la creación, buscar de nuevo (otro proceso pudo haberla creado)
            const errorRetryCheck = await strapi.db.query('api::mesa.mesa').findMany({
                where: {
                    restaurante: restauranteIdNum,
                    number: numberNum
                },
                select: ['id', 'number', 'status', 'documentId'],
                orderBy: { id: 'asc' },
                limit: 1
            });
            if (errorRetryCheck.length > 0) {
                mesa = errorRetryCheck[0];
                console.log(`[getMesaOrThrow] Mesa ${numberNum} encontrada después de error de creación (evitó duplicado)`);
            }
            else {
                // Si realmente no se pudo crear ni encontrar, lanzar error
                throw new ValidationError(`No se pudo crear ni encontrar la mesa ${numberNum}: ${createErr.message}`);
            }
        }
    }
    // Get documentId using entityService if needed (for draftAndPublish)
    let documentId = mesa.documentId;
    if (!documentId) {
        try {
            const entity = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
                fields: ['documentId'],
                publicationState: 'preview' // Include unpublished
            });
            documentId = entity === null || entity === void 0 ? void 0 : entity.documentId;
        }
        catch (err) {
            // If entityService fails, use id as fallback
            documentId = String(mesa.id);
        }
    }
    // Asegurar que la mesa esté publicada (pero NO modificar otros campos)
    if (documentId && documentId !== String(mesa.id)) {
        try {
            await strapi.entityService.update('api::mesa.mesa', documentId, {
                data: {
                    publishedAt: new Date()
                }
            });
        }
        catch (err) {
            // If update fails, continue anyway
            console.warn(`[getMesaOrThrow] Could not ensure publication for mesa ${mesa.id}:`, err);
        }
    }
    return {
        id: mesa.id,
        documentId: documentId || String(mesa.id), // Fallback to id as string if documentId not available
        number: mesa.number,
        status: mesa.status
    };
}
/**
 * Update Table Status using Entity Service to ensure proper publication
 */
async function setTableStatus(mesaId, status, currentSessionId = null) {
    var _a;
    // Guardar el currentSessionId original para usar en caso de error
    const originalCurrentSessionId = currentSessionId;
    // First, get the documentId to use with entityService
    let documentId;
    try {
        const mesa = await strapi.entityService.findOne('api::mesa.mesa', mesaId, {
            fields: ['documentId']
        });
        documentId = mesa === null || mesa === void 0 ? void 0 : mesa.documentId;
    }
    catch (err) {
        // If entityService fails, try direct DB query
        const dbMesa = await strapi.db.query('api::mesa.mesa').findOne({
            where: { id: mesaId },
            select: ['documentId']
        });
        documentId = dbMesa === null || dbMesa === void 0 ? void 0 : dbMesa.documentId;
    }
    // If we still don't have documentId, use id as fallback
    const idToUse = documentId || String(mesaId);
    console.log(`[setTableStatus] Actualizando mesa ${mesaId} (documentId: ${idToUse}) - status: ${status}, currentSession: ${currentSessionId}`);
    // ESTRATEGIA: Actualizar directamente en la base de datos para evitar problemas con draft & publish
    // entityService.update puede tener problemas con draft & publish, así que usamos DB query directamente
    try {
        const updateResult = await strapi.db.query('api::mesa.mesa').update({
            where: { id: mesaId },
            data: {
                status,
                publishedAt: new Date()
            }
        });
        console.log(`[setTableStatus] ✅ Status actualizado vía DB query: ${status}`, {
            affectedRows: (updateResult === null || updateResult === void 0 ? void 0 : updateResult.count) || 0
        });
        // Verificar inmediatamente que se actualizó
        const immediateCheck = await strapi.db.query('api::mesa.mesa').findOne({
            where: { id: mesaId },
            select: ['id', 'status', 'publishedAt']
        });
        console.log(`[setTableStatus] Verificación inmediata:`, {
            id: immediateCheck === null || immediateCheck === void 0 ? void 0 : immediateCheck.id,
            status: immediateCheck === null || immediateCheck === void 0 ? void 0 : immediateCheck.status,
            publishedAt: immediateCheck === null || immediateCheck === void 0 ? void 0 : immediateCheck.publishedAt
        });
        if ((immediateCheck === null || immediateCheck === void 0 ? void 0 : immediateCheck.status) !== status) {
            console.error(`[setTableStatus] ❌ La actualización no se aplicó correctamente. Esperado: ${status}, Actual: ${immediateCheck === null || immediateCheck === void 0 ? void 0 : immediateCheck.status}`);
            // Intentar de nuevo con entityService como fallback
            try {
                await strapi.entityService.update('api::mesa.mesa', idToUse, {
                    data: {
                        status,
                        publishedAt: new Date()
                    }
                });
                console.log(`[setTableStatus] ✅ Status actualizado vía entityService (fallback): ${status}`);
            }
            catch (entityErr) {
                console.error(`[setTableStatus] ❌ Error también con entityService:`, (entityErr === null || entityErr === void 0 ? void 0 : entityErr.message) || entityErr);
            }
        }
    }
    catch (err) {
        console.error(`[setTableStatus] ❌ Error actualizando status con DB query:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        throw new ValidationError(`No se pudo actualizar el status de la mesa: ${(err === null || err === void 0 ? void 0 : err.message) || 'Error desconocido'}`);
    }
    // Paso 2: Actualizar la relación currentSession usando DB query directo (más confiable)
    try {
        if (currentSessionId !== null) {
            // Verificar que la sesión existe
            const sessionExists = await strapi.db.query('api::mesa-sesion.mesa-sesion').findOne({
                where: { id: Number(currentSessionId) },
                select: ['id']
            });
            if (!(sessionExists === null || sessionExists === void 0 ? void 0 : sessionExists.id)) {
                console.warn(`[setTableStatus] ⚠️ Sesión ${currentSessionId} no existe, no se puede asociar`);
                // Limpiar la relación si la sesión no existe
                await strapi.db.query('api::mesa.mesa').update({
                    where: { id: mesaId },
                    data: { currentSession: null }
                });
            }
            else {
                // Actualizar la relación usando DB query directo
                await strapi.db.query('api::mesa.mesa').update({
                    where: { id: mesaId },
                    data: { currentSession: Number(currentSessionId) }
                });
                console.log(`[setTableStatus] ✅ Relación currentSession actualizada: ${currentSessionId}`);
            }
        }
        else {
            // Limpiar relación
            await strapi.db.query('api::mesa.mesa').update({
                where: { id: mesaId },
                data: { currentSession: null }
            });
            console.log(`[setTableStatus] ✅ Relación currentSession limpiada`);
        }
    }
    catch (relErr) {
        console.error(`[setTableStatus] ❌ Error actualizando relación currentSession:`, (relErr === null || relErr === void 0 ? void 0 : relErr.message) || relErr);
        // No lanzar error aquí, solo loguear - el status ya se actualizó
    }
    // Obtener el resultado final para verificar usando DB query directo
    // Esperar un momento para que la actualización se propague
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        const finalResult = await strapi.db.query('api::mesa.mesa').findOne({
            where: { id: mesaId },
            select: ['id', 'status', 'publishedAt'],
            populate: ['currentSession']
        });
        if (!finalResult) {
            console.warn(`[setTableStatus] ⚠️ No se encontró la mesa ${mesaId} después de actualizar`);
            return { id: mesaId, status, currentSession: originalCurrentSessionId };
        }
        const verifiedCurrentSessionId = ((_a = finalResult === null || finalResult === void 0 ? void 0 : finalResult.currentSession) === null || _a === void 0 ? void 0 : _a.id) || (finalResult === null || finalResult === void 0 ? void 0 : finalResult.currentSession) || null;
        console.log(`[setTableStatus] ✅ Mesa actualizada. Estado final:`, {
            id: finalResult === null || finalResult === void 0 ? void 0 : finalResult.id,
            status: finalResult === null || finalResult === void 0 ? void 0 : finalResult.status,
            publishedAt: finalResult === null || finalResult === void 0 ? void 0 : finalResult.publishedAt,
            currentSession: verifiedCurrentSessionId
        });
        // Si el status no coincide, loguear advertencia
        if ((finalResult === null || finalResult === void 0 ? void 0 : finalResult.status) !== status) {
            console.warn(`[setTableStatus] ⚠️ El status no coincide: esperado=${status}, actual=${finalResult === null || finalResult === void 0 ? void 0 : finalResult.status}`);
        }
        return {
            id: (finalResult === null || finalResult === void 0 ? void 0 : finalResult.id) || mesaId,
            status: (finalResult === null || finalResult === void 0 ? void 0 : finalResult.status) || status,
            currentSession: verifiedCurrentSessionId
        };
    }
    catch (err) {
        console.warn(`[setTableStatus] No se pudo verificar el resultado final:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        // Retornar un objeto básico si no se puede obtener el resultado completo
        return { id: mesaId, status, currentSession: originalCurrentSessionId };
    }
}
/**
 * Get active session or create new one.
 * Ensures strict State Management: If session is open, Table MUST be 'ocupada'.
 */
async function getOrCreateOpenSession(opts) {
    var _a;
    const { restauranteId, mesaId, mesaDocumentId, includePaid = false } = opts;
    // 1. Buscar sesión existente SOLO con status 'open'
    // NOTA: includePaid está deprecado - nunca debemos reutilizar sesiones 'paid'
    const existingSessions = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            session_status: 'open', // SOLO 'open', nunca 'paid' o 'closed'
        },
        fields: ['id', 'documentId', 'code', 'session_status', 'openedAt'],
        sort: ['openedAt:desc'],
        limit: 1,
        publicationState: 'preview'
    });
    if ((_a = existingSessions === null || existingSessions === void 0 ? void 0 : existingSessions[0]) === null || _a === void 0 ? void 0 : _a.id) {
        const session = existingSessions[0];
        // Verificar que la sesión esté realmente en estado 'open' (doble verificación)
        if (session.session_status === 'open') {
            // Sesión válida encontrada -> Asegurar que la mesa esté ocupada
            console.log(`[getOrCreateOpenSession] Reutilizando sesión existente ${session.id} para mesa ${mesaId}`);
            await setTableStatus(mesaId, 'ocupada', session.id);
            return session;
        }
        // Si por alguna razón la sesión no está 'open', continuar para crear una nueva
    }
    // 2. No hay sesión abierta válida -> Crear nueva
    console.log(`[getOrCreateOpenSession] Creando nueva sesión para mesa ${mesaId}`);
    const newCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const newSession = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
        data: {
            code: newCode,
            session_status: 'open',
            openedAt: new Date(),
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            publishedAt: new Date(),
        },
    });
    console.log(`[getOrCreateOpenSession] ✅ Sesión creada: ${newSession.id} para mesa ${mesaId}`);
    // Marcar mesa como ocupada y asociar currentSession
    await setTableStatus(mesaId, 'ocupada', newSession.id);
    return newSession;
}
exports.default = {
    /**
     * POST /restaurants/:slug/orders
     */
    async createOrder(ctx) {
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        if (!table || items.length === 0)
            throw new ValidationError('Invalid data');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        // Get/Create Session (implicitly sets table to 'ocupada')
        const sesion = await getOrCreateOpenSession({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            mesaDocumentId: mesa.documentId,
            includePaid: false,
        });
        // Create Order logic...
        // Normalize items and calculate total
        const normalizedItems = items.map(it => {
            var _a, _b, _c, _d;
            const q = Number((_b = (_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : it === null || it === void 0 ? void 0 : it.quantity) !== null && _b !== void 0 ? _b : 0);
            const p = Number((_d = (_c = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.price) !== null && _d !== void 0 ? _d : 0);
            const normalized = {
                quantity: q,
                unitPrice: p,
                totalPrice: q * p,
                productId: it.productId,
                notes: (it === null || it === void 0 ? void 0 : it.notes) || '',
                name: (it === null || it === void 0 ? void 0 : it.name) || '' // Preserve name for system products
            };
            return normalized;
        });
        const total = normalizedItems.reduce((s, it) => s + it.totalPrice, 0);
        // Ensure total is a valid number (not NaN)
        if (!Number.isFinite(total) || total < 0) {
            throw new ValidationError(`Invalid total calculated: ${total}. Check item prices and quantities.`);
        }
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                order_status: 'pending',
                customerNotes: (data === null || data === void 0 ? void 0 : data.customerNotes) || '',
                total: Number(total), // Explicitly ensure it's a number
                restaurante: { id: Number(restaurante.id) },
                mesa_sesion: { id: Number(sesion.id) },
                publishedAt: new Date(),
            },
        });
        // Create Items with normalized values
        await Promise.all(normalizedItems.map(async (item, index) => {
            // Ensure all values are valid numbers
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            const totalPrice = quantity * unitPrice;
            if (!item.productId) {
                throw new ValidationError(`Missing productId for item at index ${index}`);
            }
            // Check if this is a system product (sys-waiter-call, sys-pay-request, etc.)
            const isSystemProduct = typeof item.productId === 'string' && item.productId.startsWith('sys-');
            // For system products, quantity and price can be 0, but still need to be valid numbers
            if (!Number.isFinite(quantity) || quantity < 0) {
                throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity}`);
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                throw new ValidationError(`Invalid unitPrice for product ${item.productId}: ${unitPrice}`);
            }
            if (!Number.isFinite(totalPrice)) {
                throw new ValidationError(`Invalid totalPrice calculated for product ${item.productId}: ${totalPrice}`);
            }
            // For system products, we don't require quantity > 0
            if (!isSystemProduct && quantity <= 0) {
                throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity} (must be > 0 for regular products)`);
            }
            try {
                // Get the product name from the item if it's a system product
                // The frontend sends 'name' field for system products
                const systemProductName = item.name || '';
                // Build notes: include system product name if it's a system product
                let itemNotes = item.notes || '';
                if (isSystemProduct && systemProductName) {
                    itemNotes = systemProductName + (itemNotes ? ` - ${itemNotes}` : '');
                }
                const itemData = {
                    quantity: quantity,
                    notes: itemNotes,
                    UnitPrice: unitPrice,
                    totalPrice: totalPrice,
                    order: pedido.id,
                    publishedAt: new Date()
                };
                // Only set product relation if it's NOT a system product
                if (!isSystemProduct) {
                    const numericProductId = Number(item.productId);
                    if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
                        throw new ValidationError(`Invalid productId: ${item.productId} (must be a positive number for regular products)`);
                    }
                    itemData.product = numericProductId;
                }
                // For system products, product field is left undefined/null (schema allows it)
                const createdItem = await strapi.entityService.create('api::item-pedido.item-pedido', {
                    data: itemData
                });
                return createdItem;
            }
            catch (err) {
                throw new ValidationError(`Failed to create item for product ${item.productId}: ${err.message}`);
            }
        }));
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST /restaurants/:slug/open-session
     *
     * REGLAS:
     * - Si ya existe sesión 'open' válida, la reutiliza (no crea duplicado)
     * - Cierra sesiones 'paid' antes de abrir nueva (transición limpia)
     * - Garantiza que mesa.status = 'ocupada' y mesa.currentSession = sessionId
     */
    async openSession(ctx) {
        var _a, _b, _c, _d;
        try {
            const { slug } = ctx.params || {};
            // Logging detallado para diagnóstico
            console.log(`[openSession] Request recibido:`, {
                slug,
                body: ctx.request.body,
                bodyType: typeof ctx.request.body,
                hasData: 'data' in (ctx.request.body || {}),
                bodyKeys: ctx.request.body ? Object.keys(ctx.request.body) : []
            });
            // Intentar extraer el payload de múltiples formas posibles
            let data = null;
            let table = null;
            // Forma 1: body.data.table (formato Strapi estándar)
            if (((_b = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.table) !== undefined) {
                data = ctx.request.body.data;
                table = data.table;
                console.log(`[openSession] ✅ Table extraído de body.data.table:`, table);
            }
            // Forma 2: body.table (formato directo)
            else if (((_c = ctx.request.body) === null || _c === void 0 ? void 0 : _c.table) !== undefined) {
                data = ctx.request.body;
                table = data.table;
                console.log(`[openSession] ✅ Table extraído de body.table:`, table);
            }
            // Forma 3: usar getPayload helper
            else {
                data = getPayload(ctx.request.body);
                table = data === null || data === void 0 ? void 0 : data.table;
                console.log(`[openSession] Table extraído vía getPayload:`, table, `(tipo: ${typeof table})`);
            }
            // Validación más robusta del parámetro table
            if (table === undefined || table === null || table === '') {
                console.error(`[openSession] ❌ Table faltante o inválido. Body completo:`, JSON.stringify(ctx.request.body, null, 2));
                const errorMsg = `Missing or invalid table parameter. Received: ${JSON.stringify(ctx.request.body)}`;
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: errorMsg,
                        status: 400,
                        name: 'ValidationError'
                    }
                };
                return;
            }
            // Convertir a número y validar
            const tableNumber = Number(table);
            if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
                console.error(`[openSession] ❌ Table no es un número válido:`, table);
                const errorMsg = `Table must be a positive number. Received: ${table}`;
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: errorMsg,
                        status: 400,
                        name: 'ValidationError'
                    }
                };
                return;
            }
            console.log(`[openSession] Iniciando apertura de sesión para mesa ${tableNumber} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            const mesa = await getMesaOrThrow(restaurante.id, tableNumber);
            console.log(`[openSession] Mesa encontrada: ID=${mesa.id}, documentId=${mesa.documentId}, status actual=${mesa.status}`);
            // Cerrar cualquier sesión 'paid' existente antes de abrir una nueva
            // Esto permite que un cliente pueda volver a usar una mesa después de pagar
            const paidSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                where: {
                    mesa: mesa.id,
                    session_status: 'paid'
                }
            });
            if (paidSessions.length > 0) {
                console.log(`[openSession] Cerrando ${paidSessions.length} sesión(es) 'paid' antes de abrir nueva`);
                await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
                    where: { id: { $in: paidSessions.map((s) => s.id) } },
                    data: {
                        session_status: 'closed',
                        closedAt: new Date(),
                        publishedAt: new Date()
                    }
                });
            }
            // getOrCreateOpenSession:
            // - Si ya hay sesión 'open', la reutiliza y asegura que mesa esté ocupada
            // - Si no hay, crea nueva y marca mesa como ocupada
            console.log(`[openSession] Llamando a getOrCreateOpenSession para mesa ${mesa.id}`);
            const sesion = await getOrCreateOpenSession({
                restauranteId: restaurante.id,
                mesaId: mesa.id,
                mesaDocumentId: mesa.documentId
            });
            console.log(`[openSession] ✅ Sesión obtenida/creada: ${sesion.id}, status: ${sesion.session_status}`);
            // Verificar que la mesa se actualizó correctamente usando DB query directo
            // Filtramos por publishedAt para obtener solo el publicado (más reciente después de actualizar)
            try {
                const mesaVerificada = await strapi.db.query('api::mesa.mesa').findOne({
                    where: {
                        id: mesa.id,
                        publishedAt: { $notNull: true } // Solo obtener el publicado
                    },
                    select: ['id', 'status'],
                    populate: ['currentSession']
                });
                const currentSessionId = ((_d = mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.currentSession) === null || _d === void 0 ? void 0 : _d.id) || (mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.currentSession) || null;
                console.log(`[openSession] ✅ Estado de mesa verificado:`, {
                    mesaId: mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.id,
                    status: mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status,
                    currentSession: currentSessionId
                });
                // Si la mesa no se actualizó correctamente, intentar corregir
                if ((mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status) !== 'ocupada') {
                    console.warn(`[openSession] ⚠️ La mesa no está 'ocupada' después de abrir sesión. Estado actual: ${mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status}. Intentando corregir...`);
                    await setTableStatus(mesa.id, 'ocupada', sesion.id);
                }
            }
            catch (verifyErr) {
                console.warn(`[openSession] ⚠️ No se pudo verificar el estado de la mesa:`, (verifyErr === null || verifyErr === void 0 ? void 0 : verifyErr.message) || verifyErr);
                // Continuar sin verificación - la mesa debería estar actualizada por setTableStatus
            }
            ctx.body = { data: { sessionId: sesion.id, status: sesion.session_status } };
        }
        catch (err) {
            console.error(`[openSession] ❌ Error inesperado:`, err);
            ctx.status = (err === null || err === void 0 ? void 0 : err.status) || 500;
            ctx.body = {
                error: {
                    message: (err === null || err === void 0 ? void 0 : err.message) || 'Internal server error',
                    status: ctx.status,
                    name: (err === null || err === void 0 ? void 0 : err.name) || 'Error'
                }
            };
        }
    },
    /**
     * PUT /restaurants/:slug/close-session
     *
     * REGLAS:
     * - Cierra TODAS las sesiones 'open' y 'paid' de la mesa
     * - Marca mesa.status = 'disponible' y mesa.currentSession = null
     * - NO borra sesiones (solo cambia status a 'closed')
     */
    async closeSession(ctx) {
        var _a, _b, _c;
        try {
            const { slug } = ctx.params || {};
            const data = getPayload(ctx.request.body);
            const table = data === null || data === void 0 ? void 0 : data.table;
            if (!table)
                throw new ValidationError('Missing table');
            console.log(`[closeSession] Iniciando cierre de sesión para mesa ${table} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            const mesa = await getMesaOrThrow(restaurante.id, Number(table));
            console.log(`[closeSession] Mesa encontrada: ID=${mesa.id}, documentId=${mesa.documentId}, status actual=${mesa.status}`);
            // Cerrar todas las sesiones activas (open o paid) de esta mesa
            const updateRes = await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
                where: {
                    mesa: mesa.id,
                    session_status: { $in: ['open', 'paid'] }
                },
                data: {
                    session_status: 'closed',
                    closedAt: new Date(),
                    publishedAt: new Date()
                }
            });
            console.log(`[closeSession] Sesiones cerradas: ${(_a = updateRes === null || updateRes === void 0 ? void 0 : updateRes.count) !== null && _a !== void 0 ? _a : 0}`);
            // Liberar la mesa: status = 'disponible' y currentSession = null
            console.log(`[closeSession] Liberando mesa ${mesa.id}`);
            await setTableStatus(mesa.id, 'disponible', null);
            // Verificar que la mesa se actualizó correctamente
            // Verificar usando DB query directo
            // Filtramos por publishedAt para obtener solo el publicado (más reciente después de actualizar)
            let mesaVerificada = null;
            try {
                mesaVerificada = await strapi.db.query('api::mesa.mesa').findOne({
                    where: {
                        id: mesa.id,
                        publishedAt: { $notNull: true } // Solo obtener el publicado
                    },
                    select: ['id', 'status'],
                    populate: ['currentSession']
                });
                const currentSessionId = ((_b = mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.currentSession) === null || _b === void 0 ? void 0 : _b.id) || (mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.currentSession) || null;
                console.log(`[closeSession] ✅ Mesa liberada. Estado verificado:`, {
                    mesaId: mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.id,
                    status: mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status,
                    currentSession: currentSessionId
                });
            }
            catch (verifyErr) {
                console.warn(`[closeSession] ⚠️ No se pudo verificar el estado de la mesa:`, (verifyErr === null || verifyErr === void 0 ? void 0 : verifyErr.message) || verifyErr);
            }
            // Si la mesa no se actualizó correctamente, intentar corregir
            if (mesaVerificada && (mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status) !== 'disponible') {
                console.warn(`[closeSession] ⚠️ La mesa no está 'disponible' después de cerrar sesión. Estado actual: ${mesaVerificada === null || mesaVerificada === void 0 ? void 0 : mesaVerificada.status}. Intentando corregir...`);
                await setTableStatus(mesa.id, 'disponible', null);
            }
            ctx.body = { data: { success: true, updated: (_c = updateRes === null || updateRes === void 0 ? void 0 : updateRes.count) !== null && _c !== void 0 ? _c : 0 } };
        }
        catch (err) {
            console.error(`[closeSession] ❌ Error:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            // Return 200 with error info to avoid generic 500 handling in browser
            ctx.body = {
                data: { success: false },
                error: `Backend Error: ${err.message}`,
                stack: err.stack
            };
        }
    },
    /**
     * POST /restaurants/:slug/close-account
     */
    async closeAccount(ctx) {
        const { slug } = ctx.params || {};
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        if (!table)
            throw new ValidationError('Missing table');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        // Find sessions (using Low Level to be safe)
        const sessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
            where: {
                mesa: mesa.id,
                session_status: { $in: ['open', 'paid'] }
            }
        });
        // Pay Orders & Close Sessions
        if (sessions.length > 0) {
            await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
                where: { id: { $in: sessions.map((s) => s.id) } },
                data: { session_status: 'paid', publishedAt: new Date() }
            });
        }
        // Mark table as 'por_limpiar'
        await setTableStatus(mesa.id, 'por_limpiar', null);
        ctx.body = { data: { success: true } };
    },
    // DEBUGGING TOOL
    async debugSession(ctx) {
        const { id } = ctx.params || {};
        const tableNumber = Number(id);
        try {
            const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
                filters: { number: tableNumber },
                fields: ['id', 'documentId', 'status'],
                limit: 1,
                publicationState: 'preview'
            });
            const mesa = mesas[0];
            if (!mesa) {
                ctx.body = { error: 'Mesa not found' };
                return;
            }
            const results = {};
            results.strategyA = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                where: { mesa: mesa.id },
                select: ['id', 'session_status', 'publishedAt']
            });
            ctx.body = { mesa, results };
        }
        catch (err) {
            ctx.body = { error: err.message };
        }
    },
    async resetTables(ctx) {
        const { slug } = ctx.params || {};
        const restaurante = await getRestaurantBySlug(String(slug));
        const restauranteId = Number(restaurante.id);
        // FIX: Use DB Query for deletion
        await strapi.db.query('api::mesa-sesion.mesa-sesion').deleteMany({
            where: { restaurante: restauranteId }
        });
        await strapi.db.query('api::mesa.mesa').deleteMany({
            where: { restaurante: restauranteId }
        });
        const created = [];
        for (let i = 1; i <= 20; i++) {
            const newMesa = await strapi.entityService.create('api::mesa.mesa', {
                data: {
                    number: i,
                    name: `Mesa ${i}`,
                    status: 'disponible',
                    restaurante: restauranteId,
                    publishedAt: new Date(),
                }
            });
            created.push(newMesa.id);
        }
        ctx.body = { message: 'Reset done', count: created.length };
    }
};
