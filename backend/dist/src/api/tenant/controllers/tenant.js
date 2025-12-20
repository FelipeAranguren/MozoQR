"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom tenant controller
 * Endpoints:
 *  - GET  /api/restaurants/:slug/tables
 *  - GET  /api/restaurants/:slug/tables/:number
 *  - POST /api/restaurants/:slug/tables/claim
 *  - POST /api/restaurants/:slug/tables/release
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 *  - PUT /api/restaurants/:slug/close-session
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { errors } = require('@strapi/utils');
const { ValidationError, NotFoundError } = errors;
function getPayload(raw) {
    return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}
let mesaColumnSupportCache = null;
async function getMesaColumnSupport() {
    var _a, _b;
    if (mesaColumnSupportCache)
        return mesaColumnSupportCache;
    const knex = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _a === void 0 ? void 0 : _a.connection;
    // default conservative: only fields we know existed previously
    const base = {
        activeSessionCode: false,
        occupiedAt: false,
        publishedAt: true,
        displayName: true,
        isActive: true,
    };
    if (!((_b = knex === null || knex === void 0 ? void 0 : knex.schema) === null || _b === void 0 ? void 0 : _b.hasColumn)) {
        mesaColumnSupportCache = base;
        return base;
    }
    try {
        const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
        const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');
        const hasPublishedAt = await knex.schema.hasColumn('mesas', 'published_at');
        const hasDisplayName = await knex.schema.hasColumn('mesas', 'display_name');
        const hasIsActive = await knex.schema.hasColumn('mesas', 'is_active');
        mesaColumnSupportCache = {
            activeSessionCode: !!hasActiveSessionCode,
            occupiedAt: !!hasOccupiedAt,
            publishedAt: hasPublishedAt !== false,
            displayName: hasDisplayName !== false,
            isActive: hasIsActive !== false,
        };
        return mesaColumnSupportCache;
    }
    catch (_e) {
        mesaColumnSupportCache = base;
        return base;
    }
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
 * Get Table strictly by Number (NO auto-create).
 *
 * ✅ Mesas deben existir solo si el owner las creó.
 * ❌ Nunca crear mesas automáticamente por tráfico público.
 *
 * Uses direct DB query to avoid entityService relation filter issues.
 */
async function getMesaOrThrow(restauranteId, number) {
    var _a, _b, _c;
    const restauranteIdNum = Number(restauranteId);
    const numberNum = Number(number);
    // Validar parámetros
    if (!restauranteIdNum || isNaN(restauranteIdNum)) {
        throw new ValidationError(`ID de restaurante inválido: ${restauranteId}`);
    }
    if (!numberNum || isNaN(numberNum) || numberNum <= 0) {
        throw new ValidationError(`Número de mesa inválido: ${number}`);
    }
    const col = await getMesaColumnSupport();
    const select = ['id', 'number', 'status', 'documentId'];
    if (col.publishedAt)
        select.push('publishedAt');
    if (col.activeSessionCode)
        select.push('activeSessionCode');
    if (col.occupiedAt)
        select.push('occupiedAt');
    if (col.displayName)
        select.push('displayName');
    // Use direct DB query for more reliable relation filtering (include unpublished)
    const found = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
            restaurante: restauranteIdNum,
            number: numberNum
        },
        select,
        orderBy: { id: 'asc' } // Ordenar por ID para consistencia
    });
    if (!(found === null || found === void 0 ? void 0 : found.length)) {
        throw new NotFoundError(`Mesa ${numberNum} no configurada en este restaurante`);
    }
    if (found.length > 1) {
        // No arreglamos duplicados aquí (eso requiere migración/operación del owner),
        // pero evitamos romper el runtime: usamos la más antigua por ID y logueamos.
        console.error(`[getMesaOrThrow] ⚠️ DUPLICADO DETECTADO: ${found.length} mesas con número ${numberNum} en restaurante ${restauranteIdNum}`);
        console.error(`[getMesaOrThrow] IDs:`, found.map((m) => m.id));
    }
    const mesa = found[0];
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
    // Asegurar que la mesa esté publicada (solo si está en draft) para que sea visible en endpoints públicos.
    // No tocamos número/restaurante ni re-creamos nada.
    if (col.publishedAt && !(mesa === null || mesa === void 0 ? void 0 : mesa.publishedAt)) {
        try {
            await strapi.db.query('api::mesa.mesa').update({
                where: { id: mesa.id },
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
        status: mesa.status,
        activeSessionCode: col.activeSessionCode ? ((_a = mesa.activeSessionCode) !== null && _a !== void 0 ? _a : null) : null,
        occupiedAt: col.occupiedAt ? ((_b = mesa.occupiedAt) !== null && _b !== void 0 ? _b : null) : null,
        displayName: (_c = mesa.displayName) !== null && _c !== void 0 ? _c : null,
    };
}
function normalizeMesaStatus(raw) {
    if (raw === 'ocupada' || raw === 'por_limpiar' || raw === 'disponible')
        return raw;
    return 'disponible';
}
function mesaToPublicDTO(mesa) {
    var _a;
    return {
        id: mesa.id,
        number: mesa.number,
        status: normalizeMesaStatus(mesa.status),
        displayName: mesa.displayName || `Mesa ${mesa.number}`,
        occupiedAt: (_a = mesa.occupiedAt) !== null && _a !== void 0 ? _a : null,
    };
}
async function getMesaRowByNumber(restauranteId, number) {
    const restauranteIdNum = Number(restauranteId);
    const numberNum = Number(number);
    const col = await getMesaColumnSupport();
    const select = ['id', 'number', 'status'];
    if (col.displayName)
        select.push('displayName');
    if (col.activeSessionCode)
        select.push('activeSessionCode');
    if (col.occupiedAt)
        select.push('occupiedAt');
    if (col.publishedAt)
        select.push('publishedAt');
    const rows = await strapi.db.query('api::mesa.mesa').findMany({
        where: { restaurante: restauranteIdNum, number: numberNum },
        select,
        orderBy: { id: 'asc' },
        limit: 1,
    });
    return (rows === null || rows === void 0 ? void 0 : rows[0]) || null;
}
async function getOrCreateOpenSessionByCode(opts) {
    var _a, _b;
    const { restauranteId, mesaId, code } = opts;
    const existing = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            code,
            session_status: 'open',
        },
        fields: ['id', 'code', 'session_status', 'openedAt'],
        limit: 1,
        publicationState: 'preview',
    });
    if ((_a = existing === null || existing === void 0 ? void 0 : existing[0]) === null || _a === void 0 ? void 0 : _a.id)
        return existing[0];
    // Create new "open" session with code == tableSessionId (client session token).
    try {
        const created = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
            data: {
                code,
                session_status: 'open',
                openedAt: new Date(),
                restaurante: { id: Number(restauranteId) },
                mesa: { id: Number(mesaId) },
                publishedAt: new Date(),
            },
        });
        return created;
    }
    catch (_e) {
        // In case of a rare race / UID collision, re-read.
        const reread = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restauranteId) },
                mesa: { id: Number(mesaId) },
                code,
                session_status: 'open',
            },
            fields: ['id', 'code', 'session_status', 'openedAt'],
            limit: 1,
            publicationState: 'preview',
        });
        if ((_b = reread === null || reread === void 0 ? void 0 : reread[0]) === null || _b === void 0 ? void 0 : _b.id)
            return reread[0];
        throw _e;
    }
}
async function claimTableInternal(opts) {
    var _a, _b, _c, _d;
    const { restauranteId, tableNumber, tableSessionId } = opts;
    if (!tableSessionId)
        throw new ValidationError('Missing tableSessionId');
    const col = await getMesaColumnSupport();
    if (!col.activeSessionCode) {
        // Without active_session_code column we cannot enforce session ownership safely.
        throw new ValidationError('DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.');
    }
    const mesa = await getMesaOrThrow(restauranteId, tableNumber);
    const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
    const status = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
    // Idempotent: already claimed by same session.
    if (status === 'ocupada' && ((_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) === tableSessionId) {
        return { mesaId: mesa.id, sessionId: ((_c = mesa.currentSession) === null || _c === void 0 ? void 0 : _c.id) || mesa.currentSession || null, status: 'ok' };
    }
    // Legacy/contaminated data escape hatch:
    // If mesa is 'ocupada' but has NO activeSessionCode, treat it as available only when there is no open session.
    const activeCode = ((_d = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _d !== void 0 ? _d : mesa.activeSessionCode) || null;
    if (status !== 'disponible') {
        if (status === 'ocupada' && !activeCode) {
            const openSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
                where: { mesa: mesa.id, session_status: 'open' },
                select: ['id'],
                limit: 1,
            });
            if (!(openSessions === null || openSessions === void 0 ? void 0 : openSessions.length)) {
                // treat as disponible (ghost occupied)
            }
            else {
                throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
            }
        }
        else {
            throw new ValidationError(`Mesa ${tableNumber} no disponible (${status})`);
        }
    }
    // Create/open session (code == tableSessionId) then persist mesa state as source of truth.
    const sesion = await getOrCreateOpenSessionByCode({ restauranteId, mesaId: mesa.id, code: tableSessionId });
    await strapi.db.query('api::mesa.mesa').update({
        where: { id: mesa.id },
        data: {
            status: 'ocupada',
            activeSessionCode: tableSessionId,
            ...(col.occupiedAt ? { occupiedAt: new Date() } : {}),
            ...(col.publishedAt ? { publishedAt: new Date() } : {}),
        },
    });
    return { mesaId: mesa.id, sessionId: sesion.id, status: 'ok' };
}
async function releaseTableInternal(opts) {
    var _a, _b;
    const { restauranteId, tableNumber, tableSessionId, force = false } = opts;
    const col = await getMesaColumnSupport();
    if (!col.activeSessionCode) {
        throw new ValidationError('DB desactualizada: falta columna mesas.active_session_code. Reiniciá Strapi (para auto-migración) o borrá backend/.tmp/data.db en desarrollo.');
    }
    const mesa = await getMesaOrThrow(restauranteId, tableNumber);
    const mesaRow = await getMesaRowByNumber(restauranteId, tableNumber);
    const status = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
    const activeCode = ((_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) || null;
    // Idempotent release
    if (status === 'disponible')
        return { mesaId: mesa.id, released: true, status: 'ok' };
    if (!force) {
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        if (activeCode && tableSessionId !== activeCode) {
            throw new ValidationError('tableSessionId no coincide con la sesión activa');
        }
    }
    // Close open session(s) for this mesa & active code (best-effort).
    try {
        const where = { mesa: mesa.id, session_status: 'open' };
        if (activeCode)
            where.code = activeCode;
        await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
            where,
            data: { session_status: 'closed', closedAt: new Date(), publishedAt: new Date() },
        });
    }
    catch (e) {
        // ignore (mesa is still source of truth)
    }
    await strapi.db.query('api::mesa.mesa').update({
        where: { id: mesa.id },
        data: {
            status: 'disponible',
            activeSessionCode: null,
            ...(col.occupiedAt ? { occupiedAt: null } : {}),
            ...(col.publishedAt ? { publishedAt: new Date() } : {}),
        },
    });
    return { mesaId: mesa.id, released: true, status: 'ok' };
}
// NOTE: legacy helpers `setTableStatus` / `getOrCreateOpenSession` were removed in favor of:
// - `claimTableInternal` (atomic claim with tableSessionId)
// - `releaseTableInternal` (idempotent release)
// - `activeSessionCode` + `occupiedAt` persisted on `mesa` as source of truth
exports.default = {
    /**
     * GET /restaurants/:slug/tables
     * Public read-only list. Backend is the source of truth.
     */
    async listTables(ctx) {
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const restaurante = await getRestaurantBySlug(String(slug));
        const col = await getMesaColumnSupport();
        const select = ['id', 'number', 'status'];
        if (col.displayName)
            select.push('displayName');
        if (col.occupiedAt)
            select.push('occupiedAt');
        const where = {
            restaurante: Number(restaurante.id),
        };
        if (col.isActive)
            where.isActive = true;
        if (col.publishedAt)
            where.publishedAt = { $notNull: true };
        const rows = await strapi.db.query('api::mesa.mesa').findMany({
            where,
            select,
            orderBy: { number: 'asc', id: 'asc' },
        });
        // Defensive: if legacy data has duplicates (same number), keep the oldest by id.
        const seen = new Set();
        const deduped = (rows || []).filter((r) => {
            const n = Number(r === null || r === void 0 ? void 0 : r.number);
            if (!Number.isFinite(n))
                return false;
            if (seen.has(n))
                return false;
            seen.add(n);
            return true;
        });
        ctx.body = { data: deduped.map(mesaToPublicDTO) };
    },
    /**
     * GET /restaurants/:slug/tables/:number
     * Public read-only. Does NOT expose activeSessionCode.
     */
    async getTable(ctx) {
        const { slug, number } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const restaurante = await getRestaurantBySlug(String(slug));
        const col = await getMesaColumnSupport();
        const tableNumber = Number(number);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table number');
        const select = ['id', 'number', 'status'];
        if (col.displayName)
            select.push('displayName');
        if (col.occupiedAt)
            select.push('occupiedAt');
        const where = { restaurante: Number(restaurante.id), number: tableNumber };
        if (col.publishedAt)
            where.publishedAt = { $notNull: true };
        const row = await strapi.db.query('api::mesa.mesa').findOne({
            where,
            select,
        });
        if (!row)
            throw new NotFoundError('Mesa no encontrada');
        ctx.body = { data: mesaToPublicDTO(row) };
    },
    /**
     * POST /restaurants/:slug/tables/claim
     * body: { table, tableSessionId }
     *
     * Atomic at business-level: only one session can claim when AVAILABLE.
     * Idempotent: if already claimed by same tableSessionId => 200 OK.
     */
    async claimTable(ctx) {
        var _a;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = (_a = data === null || data === void 0 ? void 0 : data.table) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.number;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const tableNumber = Number(table);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table');
        try {
            const res = await claimTableInternal({ restauranteId: restaurante.id, tableNumber, tableSessionId: String(tableSessionId) });
            const row = await strapi.db.query('api::mesa.mesa').findOne({
                where: { id: Number(res.mesaId) },
                select: ['id', 'number', 'status', 'displayName', 'occupiedAt'],
            });
            ctx.body = { data: { table: row ? mesaToPublicDTO(row) : { number: tableNumber }, sessionId: res.sessionId } };
        }
        catch (e) {
            const status = Number(e === null || e === void 0 ? void 0 : e.status) ||
                Number(e === null || e === void 0 ? void 0 : e.statusCode) ||
                (String((e === null || e === void 0 ? void 0 : e.name) || '').toLowerCase().includes('notfound') ? 404 : 409);
            ctx.status = status === 404 ? 404 : 409;
            ctx.body = { error: { message: (e === null || e === void 0 ? void 0 : e.message) || (ctx.status === 404 ? 'Mesa no encontrada' : 'Mesa ocupada/no disponible') } };
        }
    },
    /**
     * POST /restaurants/:slug/tables/release
     * body: { table, tableSessionId }
     *
     * Idempotent.
     */
    async releaseTable(ctx) {
        var _a;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = (_a = data === null || data === void 0 ? void 0 : data.table) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.number;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const tableNumber = Number(table);
        if (!Number.isFinite(tableNumber) || tableNumber <= 0)
            throw new ValidationError('Invalid table');
        // Public endpoint: never allow force release via body flag.
        const force = false;
        try {
            const res = await releaseTableInternal({
                restauranteId: restaurante.id,
                tableNumber,
                tableSessionId: String(tableSessionId),
                force,
            });
            const row = await strapi.db.query('api::mesa.mesa').findOne({
                where: { id: Number(res.mesaId) },
                select: ['id', 'number', 'status', 'displayName', 'occupiedAt'],
            });
            ctx.body = { data: { released: true, table: row ? mesaToPublicDTO(row) : { number: tableNumber } } };
        }
        catch (e) {
            const status = Number(e === null || e === void 0 ? void 0 : e.status) ||
                Number(e === null || e === void 0 ? void 0 : e.statusCode) ||
                (String((e === null || e === void 0 ? void 0 : e.name) || '').toLowerCase().includes('notfound') ? 404 : 409);
            ctx.status = status === 404 ? 404 : 409;
            ctx.body = { error: { message: (e === null || e === void 0 ? void 0 : e.message) || (ctx.status === 404 ? 'Mesa no encontrada' : 'No se pudo liberar la mesa') } };
        }
    },
    /**
     * POST /restaurants/:slug/orders
     */
    async createOrder(ctx) {
        var _a, _b, _c;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        if (!table || items.length === 0)
            throw new ValidationError('Invalid data');
        if (!tableSessionId)
            throw new ValidationError('Missing tableSessionId');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
        const mesaStatus = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
        const activeCode = (_c = (_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) !== null && _c !== void 0 ? _c : null;
        // Strict validation: backend source of truth. If mesa was released or session changed, reject.
        if (mesaStatus !== 'ocupada' || !activeCode || String(activeCode) !== String(tableSessionId)) {
            if (ctx.conflict)
                return ctx.conflict('Mesa liberada o sesión inválida');
            ctx.status = 409;
            ctx.body = { error: { message: 'Mesa liberada o sesión inválida' } };
            return;
        }
        // Ensure open session exists with code == tableSessionId
        const sesion = await getOrCreateOpenSessionByCode({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            code: String(tableSessionId),
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
        var _a, _b, _c;
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
            let tableSessionId = null;
            // Forma 1: body.data.table (formato Strapi estándar)
            if (((_b = (_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.table) !== undefined) {
                data = ctx.request.body.data;
                table = data.table;
                tableSessionId = data.tableSessionId;
                console.log(`[openSession] ✅ Table extraído de body.data.table:`, table);
            }
            // Forma 2: body.table (formato directo)
            else if (((_c = ctx.request.body) === null || _c === void 0 ? void 0 : _c.table) !== undefined) {
                data = ctx.request.body;
                table = data.table;
                tableSessionId = data.tableSessionId;
                console.log(`[openSession] ✅ Table extraído de body.table:`, table);
            }
            // Forma 3: usar getPayload helper
            else {
                data = getPayload(ctx.request.body);
                table = data === null || data === void 0 ? void 0 : data.table;
                tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
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
            if (!tableSessionId) {
                ctx.status = 400;
                ctx.body = {
                    error: {
                        message: 'Missing tableSessionId (cliente debe enviar su sesión para claim)',
                        status: 400,
                        name: 'ValidationError',
                    },
                };
                return;
            }
            console.log(`[openSession] Iniciando claim para mesa ${tableNumber} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            const claimed = await claimTableInternal({
                restauranteId: restaurante.id,
                tableNumber,
                tableSessionId: String(tableSessionId),
            });
            ctx.body = { data: { sessionId: claimed.sessionId, status: 'open' } };
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
        var _a;
        try {
            const { slug } = ctx.params || {};
            const data = getPayload(ctx.request.body);
            const table = data === null || data === void 0 ? void 0 : data.table;
            const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
            if (!table)
                throw new ValidationError('Missing table');
            // If authenticated (staff/owner), allow force release without tableSessionId.
            const user = (_a = ctx === null || ctx === void 0 ? void 0 : ctx.state) === null || _a === void 0 ? void 0 : _a.user;
            const force = !!user;
            if (!tableSessionId && !force)
                throw new ValidationError('Missing tableSessionId');
            console.log(`[closeSession] Iniciando cierre de sesión para mesa ${table} en restaurante ${slug}`);
            const restaurante = await getRestaurantBySlug(String(slug));
            await releaseTableInternal({
                restauranteId: restaurante.id,
                tableNumber: Number(table),
                tableSessionId: tableSessionId ? String(tableSessionId) : null,
                force,
            });
            ctx.body = { data: { success: true } };
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
        var _a, _b, _c;
        const { slug } = ctx.params || {};
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = data === null || data === void 0 ? void 0 : data.tableSessionId;
        if (!table)
            throw new ValidationError('Missing table');
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getMesaOrThrow(restaurante.id, Number(table));
        const mesaRow = await getMesaRowByNumber(restaurante.id, Number(table));
        const mesaStatus = normalizeMesaStatus((_a = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.status) !== null && _a !== void 0 ? _a : mesa.status);
        const activeCode = (_c = (_b = mesaRow === null || mesaRow === void 0 ? void 0 : mesaRow.activeSessionCode) !== null && _b !== void 0 ? _b : mesa.activeSessionCode) !== null && _c !== void 0 ? _c : null;
        // If caller provides tableSessionId (client), enforce match.
        if (tableSessionId && activeCode && String(activeCode) !== String(tableSessionId)) {
            if (ctx.conflict)
                return ctx.conflict('Sesión inválida para cerrar cuenta');
            ctx.status = 409;
            ctx.body = { error: { message: 'Sesión inválida para cerrar cuenta' } };
            return;
        }
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
        // Mark table as 'por_limpiar' and clear active session pointer (expulsa cliente)
        await strapi.db.query('api::mesa.mesa').update({
            where: { id: mesa.id },
            data: {
                status: 'por_limpiar',
                activeSessionCode: null,
                occupiedAt: null,
                publishedAt: new Date(),
            },
        });
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
        // 🔒 Safety: never delete mesas here. This endpoint is for controlled demo/debug only.
        const allow = String(process.env.ALLOW_RESET_TABLES || '').toLowerCase() === 'true';
        const restaurantRow = await strapi.db.query('api::restaurante.restaurante').findOne({
            where: { id: restauranteId },
            select: ['id', 'is_demo'],
        });
        if (!allow || !(restaurantRow === null || restaurantRow === void 0 ? void 0 : restaurantRow.is_demo)) {
            ctx.status = 404;
            ctx.body = { error: { message: 'Not found' } };
            return;
        }
        // Close open sessions (no delete)
        await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
            where: { restaurante: restauranteId, session_status: 'open' },
            data: { session_status: 'closed', closedAt: new Date(), publishedAt: new Date() },
        });
        // Reset mesas state (no delete)
        await strapi.db.query('api::mesa.mesa').updateMany({
            where: { restaurante: restauranteId },
            data: {
                status: 'disponible',
                activeSessionCode: null,
                occupiedAt: null,
                publishedAt: new Date(),
            },
        });
        ctx.body = { message: 'Reset done (non-destructive)' };
    }
};
