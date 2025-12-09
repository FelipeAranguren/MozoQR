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
 * Get Table strictly by Number. Throws if not found.
 * Uses direct DB query to avoid entityService relation filter issues.
 */
async function getMesaOrThrow(restauranteId, number) {
    // Use direct DB query for more reliable relation filtering
    const found = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
            restaurante: Number(restauranteId),
            number: Number(number)
        },
        select: ['id', 'number', 'status'],
        limit: 1
    });
    const mesa = found === null || found === void 0 ? void 0 : found[0];
    if (!(mesa === null || mesa === void 0 ? void 0 : mesa.id)) {
        // Debug: Try to see what mesas exist for this restaurant
        const allMesas = await strapi.db.query('api::mesa.mesa').findMany({
            where: { restaurante: Number(restauranteId) },
            select: ['id', 'number']
        });
        console.error(`[getMesaOrThrow] Mesa ${number} no encontrada para restaurante ${restauranteId}. Mesas disponibles:`, allMesas.map(m => `ID:${m.id} number:${m.number}`).join(', '));
        throw new ValidationError(`Mesa ${number} no existe.`);
    }
    // Get documentId using entityService if needed (for draftAndPublish)
    let documentId;
    try {
        const entity = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
            fields: ['documentId']
        });
        documentId = entity === null || entity === void 0 ? void 0 : entity.documentId;
    }
    catch (err) {
        // If entityService fails, try to get it from the DB result
        documentId = mesa.documentId;
    }
    return {
        id: mesa.id,
        documentId: documentId || String(mesa.id), // Fallback to id as string if documentId not available
        number: mesa.number,
        status: mesa.status
    };
}
/**
 * Direct DB Update for Table Status (Bypasses Entity Service)
 */
async function setTableStatus(mesaId, status, currentSessionId = null) {
    // Using strapi.db.query to avoid Draft/Publish issues
    await strapi.db.query('api::mesa.mesa').update({
        where: { id: mesaId },
        data: {
            status,
            currentSession: currentSessionId,
            publishedAt: new Date() // Force publish
        }
    });
}
/**
 * Get active session or create new one.
 * Ensures strict State Management: If session is open, Table MUST be 'ocupada'.
 */
async function getOrCreateOpenSession(opts) {
    var _a;
    const { restauranteId, mesaId, mesaDocumentId, includePaid = false } = opts;
    // 1. Search for existing session
    const statusFilters = ['open'];
    if (includePaid)
        statusFilters.push('paid');
    const existingSessions = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            session_status: { $in: statusFilters },
        },
        fields: ['id', 'documentId', 'code', 'session_status', 'openedAt'],
        sort: ['openedAt:desc'],
        limit: 1,
        publicationState: 'preview'
    });
    if ((_a = existingSessions === null || existingSessions === void 0 ? void 0 : existingSessions[0]) === null || _a === void 0 ? void 0 : _a.id) {
        const session = existingSessions[0];
        const hoursDiff = (Date.now() - new Date(session.openedAt).getTime()) / (1000 * 60 * 60);
        // Auto-close old sessions (>24h)
        if (session.session_status === 'open' && hoursDiff > 24) {
            await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.documentId, {
                data: { session_status: 'closed', closedAt: new Date() },
            });
            // Fall through to create new
        }
        else {
            // Valid session found -> Ensure table is 'ocupada'
            await setTableStatus(mesaId, 'ocupada', session.id);
            return session;
        }
    }
    // 2. Create new session
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
    console.log(`[getOrCreateOpenSession] Created Session: ${newSession.id}`);
    // Mark table Occupied (Low Level)
    await setTableStatus(mesaId, 'ocupada', newSession.id);
    console.log(`[getOrCreateOpenSession] Updated Table ${mesaId} status to 'ocupada'`);
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
            return {
                quantity: q,
                unitPrice: p,
                totalPrice: q * p,
                productId: it.productId,
                notes: (it === null || it === void 0 ? void 0 : it.notes) || ''
            };
        });
        const total = normalizedItems.reduce((s, it) => s + it.totalPrice, 0);
        // Ensure total is a valid number (not NaN)
        if (!Number.isFinite(total) || total < 0) {
            throw new ValidationError(`Invalid total calculated: ${total}. Check item prices and quantities.`);
        }
        console.log(`[createOrder] Creating order for restaurant ${restaurante.id}, table ${table}, session ${sesion.id}, total: ${total}, items: ${items.length}`);
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
        console.log(`[createOrder] Order created successfully: id=${pedido.id}, documentId=${pedido.documentId}`);
        // Create Items with normalized values
        await Promise.all(normalizedItems.map(async (item, index) => {
            // Ensure all values are valid numbers
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            const totalPrice = quantity * unitPrice;
            if (!item.productId) {
                throw new ValidationError(`Missing productId for item at index ${index}`);
            }
            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity}`);
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                throw new ValidationError(`Invalid unitPrice for product ${item.productId}: ${unitPrice}`);
            }
            if (!Number.isFinite(totalPrice)) {
                throw new ValidationError(`Invalid totalPrice calculated for product ${item.productId}: ${totalPrice}`);
            }
            try {
                const createdItem = await strapi.entityService.create('api::item-pedido.item-pedido', {
                    data: {
                        quantity: quantity,
                        notes: item.notes || '',
                        UnitPrice: unitPrice,
                        totalPrice: totalPrice,
                        order: pedido.id,
                        product: Number(item.productId), // Ensure productId is a number
                        publishedAt: new Date()
                    }
                });
                console.log(`[createOrder] Created item ${index + 1}/${normalizedItems.length}: productId=${item.productId}, quantity=${quantity}, unitPrice=${unitPrice}, totalPrice=${totalPrice}`);
                return createdItem;
            }
            catch (err) {
                console.error(`[createOrder] Error creating item for product ${item.productId}:`, err);
                throw new ValidationError(`Failed to create item for product ${item.productId}: ${err.message}`);
            }
        }));
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST /restaurants/:slug/open-session
     */
    async openSession(ctx) {
        const { slug } = ctx.params || {};
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        if (!table)
            throw new ValidationError('Missing table');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        const sesion = await getOrCreateOpenSession({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            mesaDocumentId: mesa.documentId
        });
        ctx.body = { data: { sessionId: sesion.id, status: sesion.session_status } };
    },
    /**
     * PUT /restaurants/:slug/close-session
     * "Soft Close & Publish" Strategy
     */
    async closeSession(ctx) {
        var _a;
        console.log('[closeSession] START');
        try {
            const { slug } = ctx.params || {};
            const data = getPayload(ctx.request.body);
            const table = data === null || data === void 0 ? void 0 : data.table;
            if (!table)
                throw new ValidationError('Missing table');
            // 1. Get Restaurant & Table
            console.log('[closeSession] Fetching Restaurant/Table...');
            const restaurante = await getRestaurantBySlug(String(slug));
            const mesa = await getMesaOrThrow(restaurante.id, Number(table));
            console.log(`[closeSession DB] Closing Table ${table} (ID: ${mesa.id} / DocID: ${mesa.documentId})`);
            // 2. Soft Close & Publish Sessions
            // FIX: "Shotgun" Query - Match by ID OR DocumentId to capture any relation format
            console.log(`[closeSession] Robust Query: mesa.id=${mesa.id} OR mesa.documentId=${mesa.documentId}`);
            const updateRes = await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
                where: {
                    $or: [
                        { mesa: { id: mesa.id } },
                        { mesa: { documentId: mesa.documentId } }
                    ],
                    session_status: { $in: ['open', 'paid'] }
                },
                data: {
                    session_status: 'closed',
                    closedAt: new Date(),
                    publishedAt: new Date()
                }
            });
            console.log(`[closeSession] updateMany result:`, updateRes);
            // 3. Update Table Status
            console.log('[closeSession] Updating Table Status to disponible...');
            await setTableStatus(mesa.id, 'disponible', null);
            console.log('[closeSession] Table Status Updated.');
            ctx.body = { data: { success: true, updated: (_a = updateRes === null || updateRes === void 0 ? void 0 : updateRes.count) !== null && _a !== void 0 ? _a : 0 } };
        }
        catch (err) {
            console.error('[closeSession CRITICAL ERROR]', err);
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
