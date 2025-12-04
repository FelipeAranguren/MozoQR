"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom tenant controller
 * Endpoints:
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 */
const utils_1 = require("@strapi/utils");
const { ValidationError, NotFoundError } = utils_1.errors;
function getPayload(raw) {
    // Acepta { data: {...} } o {...}
    return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}
/* -------------------------------------------------------
 * Helpers (REST-safe: usamos ids planos)
 * ----------------------------------------------------- */
/** Busca restaurante por slug y devuelve { id, name } */
async function getRestaurantBySlug(slug) {
    const rows = await strapi.entityService.findMany('api::restaurante.restaurante', {
        filters: { slug },
        fields: ['id', 'name'],
        limit: 1,
    });
    const r = rows === null || rows === void 0 ? void 0 : rows[0];
    if (!(r === null || r === void 0 ? void 0 : r.id))
        throw new NotFoundError('Restaurante no encontrado');
    return { id: r.id, name: r.name };
}
/**
 * Devuelve la Mesa existente (por restaurante + number).
 * Ya no crea mesas automáticamente: si no existe, lanza ValidationError.
 */
async function getOrCreateMesa(restauranteId, number) {
    const found = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: { restaurante: { id: Number(restauranteId) }, number },
        fields: ['id', 'number'],
        limit: 1,
    });
    const mesa = found === null || found === void 0 ? void 0 : found[0];
    if (!(mesa === null || mesa === void 0 ? void 0 : mesa.id)) {
        throw new ValidationError(`Mesa ${number} no existe para este restaurante`);
    }
    return mesa;
}
/**
 * Devuelve la sesión ABIERTA para esa mesa.
 * Estrategia: primero buscar una 'open' por (restaurante, mesa).
 * Si no hay, crear una nueva (code autogenerado).
 * Ignoramos 'code' para reutilizar por robustez (evita “primer pedido sin sesión”).
 */
async function getOrCreateOpenSession(opts) {
    var _a;
    const { restauranteId, mesaId, includePaid = false, checkRecentClosed = false } = opts;
    // 0) Si se pide chequear cerradas recientes (para evitar rebote al liberar mesa)
    // 0) Si se pide chequear cerradas recientes (para evitar rebote al liberar mesa)
    if (checkRecentClosed) {
        // ESTRATEGIA "MESA LOCK":
        // En lugar de buscar sesiones cerradas (que puede fallar si hay muchas o duplicados),
        // verificamos cuándo fue la última vez que se tocó la MESA.
        // Como 'closeSession' ahora actualiza la mesa (limpiando currentSession),
        // el campo 'updatedAt' de la mesa será muy reciente.
        const mesa = await strapi.entityService.findOne('api::mesa.mesa', mesaId, {
            fields: ['updatedAt'],
        });
        if (mesa === null || mesa === void 0 ? void 0 : mesa.updatedAt) {
            const lastUpdate = new Date(mesa.updatedAt).getTime();
            const now = Date.now();
            const diffSeconds = (now - lastUpdate) / 1000;
            // Si la mesa se actualizó hace menos de 45 segundos, asumimos que fue una liberación reciente.
            // Bloqueamos la creación de nuevas sesiones automáticas.
            if (diffSeconds < 45) {
                console.log(`[getOrCreateOpenSession] Mesa ${mesaId} - Mesa actualizada hace ${diffSeconds.toFixed(1)}s (Lock activo). Ignorando solicitud de apertura.`);
                return null;
            }
        }
    }
    // 1) Buscar sesión existente (open y opcionalmente paid)
    const statusFilters = ['open'];
    if (includePaid)
        statusFilters.push('paid');
    const existingSessions = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            session_status: { $in: statusFilters },
        },
        fields: ['id', 'code', 'session_status', 'openedAt'],
        sort: ['openedAt:desc', 'createdAt:desc'],
        limit: 1,
    });
    if ((_a = existingSessions === null || existingSessions === void 0 ? void 0 : existingSessions[0]) === null || _a === void 0 ? void 0 : _a.id) {
        const session = existingSessions[0];
        const openedAt = session.openedAt ? new Date(session.openedAt).getTime() : 0;
        const now = Date.now();
        const hoursDiff = (now - openedAt) / (1000 * 60 * 60);
        console.log(`[getOrCreateOpenSession] Mesa ${mesaId} - Sesión encontrada: ${session.id} (${session.session_status})`);
        // Si la sesión tiene más de 24 horas, la cerramos y creamos una nueva (solo si es 'open')
        // Si es 'paid', NO la cerramos automáticamente aquí, porque puede estar esperando limpieza
        if (session.session_status === 'open' && hoursDiff > 24) {
            console.log(`[getOrCreateOpenSession] Sesión ${session.id} es antigua (>24h). Cerrando y creando nueva.`);
            await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.id, {
                data: { session_status: 'closed', closedAt: new Date() },
            });
            // Continuamos para crear una nueva sesión...
        }
        else {
            // Si es 'paid', retornarla tal cual para mantener el estado "Por limpiar"
            if (session.session_status === 'paid') {
                return session;
            }
            console.log(`[getOrCreateOpenSession] Sesión ${session.id} es válida. Actualizando timestamp y retornando.`);
            // Actualizar timestamp para que parezca reciente
            await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.id, {
                data: { openedAt: new Date() },
            });
            return session;
        }
    }
    else {
        console.log(`[getOrCreateOpenSession] No se encontró sesión activa para Mesa ${mesaId}. Creando nueva.`);
    }
    // 2) Crear una nueva
    const newCode = Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
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
    // Actualizar estado de mesa a 'ocupada'
    await strapi.entityService.update('api::mesa.mesa', mesaId, {
        data: { status: 'ocupada' },
    });
    return newSession;
}
/** Crea los ítems de un pedido (ids planos) */
async function createItems(pedidoId, items) {
    await Promise.all((items || []).map((it) => {
        var _a, _b, _c, _d, _e;
        const quantity = Number((_b = (_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : it === null || it === void 0 ? void 0 : it.quantity) !== null && _b !== void 0 ? _b : 0);
        const unitPrice = Number((_d = (_c = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.price) !== null && _d !== void 0 ? _d : 0);
        const total = Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0;
        const rawProductId = (_e = it === null || it === void 0 ? void 0 : it.productId) !== null && _e !== void 0 ? _e : it === null || it === void 0 ? void 0 : it.id;
        const productId = rawProductId !== undefined &&
            rawProductId !== null &&
            typeof rawProductId === 'string' &&
            /^\d+$/.test(rawProductId)
            ? Number(rawProductId)
            : typeof rawProductId === 'number'
                ? rawProductId
                : null;
        return strapi.entityService.create('api::item-pedido.item-pedido', {
            data: {
                quantity,
                notes: (it === null || it === void 0 ? void 0 : it.notes) || '',
                UnitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
                totalPrice: total,
                order: pedidoId,
                ...(productId ? { product: productId } : {}),
                publishedAt: new Date(),
            },
        });
    }));
}
/* -------------------------------------------------------
 * Controller
 * ----------------------------------------------------- */
exports.default = {
    /**
     * POST /restaurants/:slug/orders
     * Body esperado: { table: number, items: [...], total?: number, customerNotes?: string }
     */
    async createOrder(ctx) {
        var _a, _b;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        const customerNotes = (_b = (_a = data === null || data === void 0 ? void 0 : data.customerNotes) !== null && _a !== void 0 ? _a : data === null || data === void 0 ? void 0 : data.notes) !== null && _b !== void 0 ? _b : '';
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new ValidationError('Empty items');
        }
        // Restaurante
        const restaurante = await getRestaurantBySlug(String(slug));
        // Mesa & Sesión (única sesión "open" por mesa)
        const mesa = await getOrCreateMesa(restaurante.id, Number(table));
        const sesion = await getOrCreateOpenSession({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            includePaid: false, // Al crear pedido, queremos una sesión 'open'. Si hay 'paid', se creará una nueva 'open' (?)
            // OJO: Si hay una 'paid' (por limpiar) y entra un pedido nuevo, ¿deberíamos reabrirla o crear nueva?
            // Lo estándar es crear nueva o reabrir. Por ahora dejamos comportamiento default:
            // Si hay 'paid' pero no 'open', getOrCreateOpenSession (con includePaid=false) no la ve,
            // así que crea una nueva 'open'. Esto es correcto: nueva gente se sienta en mesa sucia.
            checkRecentClosed: false, // Si van a pedir, ignoramos el bloqueo de "recién cerrada".
        });
        // Total (del cliente o calculado)
        const total = (data === null || data === void 0 ? void 0 : data.total) !== undefined && (data === null || data === void 0 ? void 0 : data.total) !== null && (data === null || data === void 0 ? void 0 : data.total) !== ''
            ? Number(data.total)
            : items.reduce((s, it) => {
                var _a, _b, _c, _d;
                const q = Number((_b = (_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : it === null || it === void 0 ? void 0 : it.quantity) !== null && _b !== void 0 ? _b : 0);
                const p = Number((_d = (_c = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.price) !== null && _d !== void 0 ? _d : 0);
                const line = q * p;
                return s + (Number.isFinite(line) ? line : 0);
            }, 0);
        // Crear pedido vinculado a la sesión (usar objeto { id } para la relación)
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                order_status: 'pending',
                customerNotes,
                total,
                restaurante: { id: Number(restaurante.id) },
                mesa_sesion: { id: Number(sesion.id) },
                publishedAt: new Date(),
            },
        });
        // Asegurar que la mesa esté marcada como ocupada
        if (mesa.status !== 'ocupada') {
            await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                data: { status: 'ocupada' },
            });
        }
        // Ítems
        await createItems(pedido.id, items);
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST|PUT /restaurants/:slug/close-account
     * Body: { table: number }
     * Marca como 'paid' los pedidos de la sesión abierta para esa mesa
     * y cierra la sesión. Limpia mesa.currentSession (si lo usás).
     */
    async closeAccount(ctx) {
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        // Restaurante, mesa y sesión abierta actual
        const restaurante = await getRestaurantBySlug(String(slug));
        const mesa = await getOrCreateMesa(restaurante.id, Number(table));
        const openList = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                mesa: { id: Number(mesa.id) },
                session_status: 'open',
            },
            fields: ['id'],
            sort: ['openedAt:desc', 'createdAt:desc'],
            limit: 1,
        });
        const sesion = (openList === null || openList === void 0 ? void 0 : openList[0]) || null;
        if (!(sesion === null || sesion === void 0 ? void 0 : sesion.id)) {
            ctx.body = { data: { paidOrders: 0 } };
            return;
        }
        // Pedidos NO pagados de esa sesión
        const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: { mesa_sesion: { id: Number(sesion.id) }, order_status: { $ne: 'paid' } },
            fields: ['id'],
            limit: 1000,
        });
        const ids = (pedidos || []).map((p) => p.id);
        await Promise.all(ids.map((id) => strapi.entityService.update('api::pedido.pedido', id, {
            data: { order_status: 'paid' },
        })));
        // Cerrar la sesión (marcar como 'paid' y poner closedAt)
        await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
            data: { session_status: 'paid', closedAt: new Date() },
        });
        // Limpia la referencia de sesión actual en la mesa (si la usás)
        try {
            await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                data: { currentSession: null, status: 'por_limpiar' },
            });
        }
        catch {
            // opcional: si no existe el campo, ignorar
        }
        ctx.body = { data: { paidOrders: ids.length } };
    },
    /**
     * POST /restaurants/:slug/open-session
     * Body: { table: number }
     * Abre una sesión de mesa (marca la mesa como ocupada) aunque no haya pedido todavía
     */
    async openSession(ctx) {
        var _a;
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        // Restaurante
        const restaurante = await getRestaurantBySlug(String(slug));
        // Mesa (debe existir, no creamos automáticamente)
        const found = await strapi.entityService.findMany('api::mesa.mesa', {
            filters: { restaurante: { id: Number(restaurante.id) }, number: Number(table) },
            fields: ['id', 'number'],
            limit: 1,
        });
        if (!((_a = found === null || found === void 0 ? void 0 : found[0]) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new ValidationError(`Mesa ${table} no existe para este restaurante`);
        }
        const mesa = found[0];
        // Crear o reutilizar sesión abierta
        const sesion = await getOrCreateOpenSession({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            includePaid: true, // Reutilizar sesión 'paid' si existe (para que siga "Por limpiar")
            checkRecentClosed: true, // No reabrir si se cerró hace poco (para evitar rebote al liberar)
        });
        if (!sesion) {
            // Se ignoró la apertura (ej. porque se cerró hace poco)
            ctx.body = { data: { status: 'ignored', message: 'Table recently released' } };
            return;
        }
        ctx.body = { data: { sessionId: sesion.id, code: sesion.code, status: sesion.session_status } };
    },
    /**
     * PUT /restaurants/:slug/close-session
     * Body: { table: number }
     * Cierra la sesión de una mesa (liberar mesa)
     */
    async closeSession(ctx) {
        const { slug } = ctx.params || {};
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const data = getPayload(ctx.request.body);
        const table = data === null || data === void 0 ? void 0 : data.table;
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        // Restaurante
        const restaurante = await getRestaurantBySlug(String(slug));
        // 1. Buscar TODAS las mesas con ese número (por si hay duplicados)
        const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                number: Number(table)
            },
            fields: ['id', 'number'],
        });
        const mesaIds = mesas.map((m) => m.id);
        console.log(`[closeSession] Mesas encontradas para número ${table}:`, mesaIds);
        if (mesaIds.length === 0) {
            // Si no hay mesa, no hay nada que cerrar, pero devolvemos éxito para no romper el front
            ctx.body = { data: { status: 'closed', message: 'Table not found, nothing to close' } };
            return;
        }
        // 2. Buscar sesiones abiertas de ESAS mesas (usando IDs explícitos)
        const openList = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                mesa: { id: { $in: mesaIds } },
                session_status: { $in: ['open', 'paid'] },
            },
            fields: ['id', 'session_status'],
            populate: { mesa: { fields: ['id', 'number'] } },
            limit: 100,
        });
        console.log(`[closeSession] DEBUG: Sessions found to close for Mesa ${table} (IDs: ${mesaIds.join(',')}):`, openList.map((s) => s.id));
        // 3. Cerrar TODAS las sesiones encontradas
        if (openList.length > 0) {
            await Promise.all(openList.map(async (sesion) => {
                console.log(`[closeSession] FORCE CLOSING session ${sesion.id}`);
                try {
                    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
                        data: { session_status: 'closed', closedAt: new Date() },
                    });
                }
                catch (err) {
                    console.error(`[closeSession] Error closing session ${sesion.id}:`, err);
                }
            }));
        }
        // 4. Actualizar TODAS las mesas a 'disponible'
        console.log(`[closeSession] Setting status 'disponible' for mesas: ${mesaIds.join(', ')}`);
        await Promise.all(mesaIds.map(async (mId) => {
            try {
                await strapi.entityService.update('api::mesa.mesa', mId, {
                    data: { currentSession: null, status: 'disponible' },
                });
            }
            catch (err) {
                console.warn(`[closeSession] Could not update mesa ${mId}`, err);
            }
        }));
        console.log(`[closeSession] Hard Close completed for Table ${table}`);
        // Respuesta final con DEBUG info
        ctx.body = {
            data: {
                status: 'closed',
                message: 'Table released and sessions closed',
                debug: {
                    slug,
                    tableNumber: table,
                    restauranteId: restaurante.id,
                    mesasFound: mesaIds.length,
                    mesaIds: mesaIds,
                    sessionsFound: openList.length,
                    sessionIds: openList.map((s) => s.id),
                    clearedMesas: mesaIds.length
                }
            }
        };
    },
};
