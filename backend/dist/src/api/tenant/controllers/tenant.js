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
            // Si es 'paid', NO la reutilizamos. Debe cerrarse primero.
            // Las sesiones 'paid' deben ser cerradas explícitamente antes de crear nuevas sesiones.
            if (session.session_status === 'paid') {
                console.log(`[getOrCreateOpenSession] Sesión ${session.id} está 'paid'. Cerrando y creando nueva.`);
                await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.id, {
                    data: { session_status: 'closed', closedAt: new Date() },
                });
                // Continuamos para crear una nueva sesión...
            }
            else {
                console.log(`[getOrCreateOpenSession] Sesión ${session.id} es válida. Actualizando timestamp y retornando.`);
                // Actualizar timestamp para que parezca reciente
                await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.id, {
                    data: { openedAt: new Date() },
                });
                // CRÍTICO: SIEMPRE marcar la mesa como ocupada cuando se reutiliza una sesión
                // Si hay una sesión abierta, la mesa DEBE estar ocupada sin excepciones
                try {
                    await strapi.entityService.update('api::mesa.mesa', mesaId, {
                        data: { status: 'ocupada' },
                    });
                    console.log(`[getOrCreateOpenSession] ✅ Mesa ${mesaId} FORZADA a estado 'ocupada' al reutilizar sesión`);
                }
                catch (err) {
                    console.error(`[getOrCreateOpenSession] ❌ ERROR: No se pudo marcar mesa ${mesaId} como ocupada:`, err);
                }
                return session;
            }
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
        // Solo actualizar si no está ya ocupada (evitar sobrescribir si ya está ocupada)
        if (mesa.status !== 'ocupada') {
            console.log(`[createOrder] Marcando mesa ${mesa.id} (número ${table}) como 'ocupada'`);
            await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                data: { status: 'ocupada' },
            });
        }
        else {
            console.log(`[createOrder] Mesa ${mesa.id} (número ${table}) ya está marcada como 'ocupada'`);
        }
        // Ítems
        await createItems(pedido.id, items);
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST|PUT /restaurants/:slug/close-account
     * Body: { table: number }
     * Marca como 'paid' TODOS los pedidos de TODAS las sesiones activas (open y paid) de esa mesa,
     * cierra TODAS las sesiones como 'closed' (no 'paid') y marca la mesa como 'disponible'.
     * Esto asegura que la mesa quede completamente liberada después del pago.
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
        // Buscar TODAS las sesiones activas (open y paid) para cerrarlas completamente
        // IMPORTANTE: También buscar sesiones 'closed' recientes por si acaso hay alguna inconsistencia
        const openList = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                mesa: { id: Number(mesa.id) },
                session_status: { $in: ['open', 'paid'] }, // Cerrar tanto 'open' como 'paid'
            },
            fields: ['id', 'session_status', 'openedAt'],
            sort: ['openedAt:desc', 'createdAt:desc'],
            limit: 100, // Cerrar todas las sesiones activas, no solo una
        });
        console.log(`[closeAccount] Mesa ${table} (ID: ${mesa.id}): Encontradas ${openList.length} sesión(es) activa(s) para cerrar`);
        if (!openList || openList.length === 0) {
            console.log(`[closeAccount] Mesa ${table} (ID: ${mesa.id}): No hay sesiones activas para cerrar. Verificando estado de la mesa...`);
            // Aunque no haya sesiones, asegurarse de que la mesa esté marcada como disponible
            // Esto es importante porque puede haber sesiones 'closed' pero la mesa todavía marcada como 'ocupada'
            try {
                const currentMesa = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
                    fields: ['id', 'number', 'status'],
                });
                if ((currentMesa === null || currentMesa === void 0 ? void 0 : currentMesa.status) !== 'disponible') {
                    console.log(`[closeAccount] Mesa ${table} no tiene sesiones activas pero está en estado '${currentMesa === null || currentMesa === void 0 ? void 0 : currentMesa.status}'. Actualizando a 'disponible'...`);
                    await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                        data: { currentSession: null, status: 'disponible' },
                    });
                    console.log(`[closeAccount] ✅ Mesa ${table} actualizada a 'disponible'`);
                }
                else {
                    console.log(`[closeAccount] ✅ Mesa ${table} ya está en estado 'disponible'`);
                }
            }
            catch (err) {
                console.error(`[closeAccount] ❌ Error al verificar/actualizar mesa ${mesa.id}:`, err);
            }
            ctx.body = { data: { paidOrders: 0, closedSessions: 0 } };
            return;
        }
        // Obtener todos los IDs de sesiones para cerrar
        const sessionIds = openList.map((s) => s.id);
        // Marcar como 'paid' TODOS los pedidos NO pagados de TODAS las sesiones
        const allPedidos = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: {
                mesa_sesion: { id: { $in: sessionIds } },
                order_status: { $ne: 'paid' }
            },
            fields: ['id'],
            limit: 1000,
        });
        const orderIds = (allPedidos || []).map((p) => p.id);
        // Marcar todos los pedidos como pagados
        await Promise.all(orderIds.map((id) => strapi.entityService.update('api::pedido.pedido', id, {
            data: { order_status: 'paid' },
        })));
        // Cerrar TODAS las sesiones (marcar como 'closed' y poner closedAt)
        // Al pagar, todas las sesiones deben quedar completamente cerradas, no 'paid'
        console.log(`[closeAccount] Cerrando ${sessionIds.length} sesión(es) de mesa ${table}...`);
        await Promise.all(sessionIds.map(async (sessionId) => {
            try {
                await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sessionId, {
                    data: { session_status: 'closed', closedAt: new Date() },
                });
                console.log(`[closeAccount] ✅ Sesión ${sessionId} cerrada correctamente`);
            }
            catch (err) {
                console.error(`[closeAccount] ❌ Error al cerrar sesión ${sessionId}:`, err);
            }
        }));
        // Verificar que todas las sesiones se cerraron correctamente
        const verifySessions = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                mesa: { id: Number(mesa.id) },
                session_status: { $in: ['open', 'paid'] },
            },
            fields: ['id', 'session_status'],
            limit: 10,
        });
        if (verifySessions.length > 0) {
            console.error(`[closeAccount] ⚠️ ADVERTENCIA: Mesa ${table} todavía tiene ${verifySessions.length} sesión(es) activa(s) después de cerrar:`, verifySessions.map((s) => ({ id: s.id, status: s.session_status })));
            // Intentar cerrarlas de nuevo
            await Promise.all(verifySessions.map(async (s) => {
                try {
                    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', s.id, {
                        data: { session_status: 'closed', closedAt: new Date() },
                    });
                    console.log(`[closeAccount] ✅ Sesión ${s.id} cerrada en segundo intento`);
                }
                catch (err) {
                    console.error(`[closeAccount] ❌ Error al cerrar sesión ${s.id} en segundo intento:`, err);
                }
            }));
        }
        else {
            console.log(`[closeAccount] ✅ Verificación: Todas las sesiones de mesa ${table} están cerradas`);
        }
        // Limpia la referencia de sesión actual en la mesa y marca como disponible
        try {
            console.log(`[closeAccount] Actualizando mesa ${mesa.id} (número ${table}) a estado 'disponible'`);
            const updatedMesa = await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                data: { currentSession: null, status: 'disponible' },
            });
            // Verificar que se actualizó correctamente
            const verifyMesa = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
                fields: ['id', 'number', 'status'],
            });
            console.log(`[closeAccount] ✅ Mesa ${mesa.id} actualizada. Estado verificado: ${(verifyMesa === null || verifyMesa === void 0 ? void 0 : verifyMesa.status) || 'N/A'}`);
            if ((verifyMesa === null || verifyMesa === void 0 ? void 0 : verifyMesa.status) !== 'disponible') {
                console.error(`[closeAccount] ⚠️ ADVERTENCIA: Mesa ${mesa.id} no se actualizó correctamente. Estado actual: ${verifyMesa === null || verifyMesa === void 0 ? void 0 : verifyMesa.status}`);
            }
        }
        catch (err) {
            console.error(`[closeAccount] ❌ Error al actualizar mesa ${mesa.id}:`, err);
            // opcional: si no existe el campo, ignorar
        }
        console.log(`[closeAccount] ✅ Cuenta cerrada para mesa ${table}. Pedidos pagados: ${orderIds.length}, Sesiones cerradas: ${sessionIds.length}`);
        ctx.body = { data: { paidOrders: orderIds.length, closedSessions: sessionIds.length } };
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
        // NOTA: Cuando un cliente selecciona una mesa, SIEMPRE debemos abrir una sesión y marcar como ocupada
        // Solo usamos checkRecentClosed cuando se libera manualmente desde el mostrador
        const sesion = await getOrCreateOpenSession({
            restauranteId: restaurante.id,
            mesaId: mesa.id,
            includePaid: false, // No reutilizar sesiones 'paid', deben estar cerradas
            checkRecentClosed: false, // NO bloquear apertura - si el cliente selecciona la mesa, debe abrirse
        });
        if (!sesion) {
            // Si no se pudo crear la sesión, intentar de todas formas marcar la mesa como ocupada
            // Esto puede pasar si hay algún error, pero queremos que la mesa se marque como ocupada
            console.log(`[openSession] No se pudo crear sesión para mesa ${table}, pero marcando mesa como ocupada de todas formas`);
            try {
                await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                    data: { status: 'ocupada' },
                });
                console.log(`[openSession] Mesa ${table} marcada como ocupada sin sesión`);
            }
            catch (err) {
                console.error(`[openSession] Error al marcar mesa ${table} como ocupada:`, err);
            }
            ctx.body = { data: { status: 'partial', message: 'Table marked as occupied but session creation failed' } };
            return;
        }
        // CRÍTICO: SIEMPRE marcar la mesa como ocupada cuando se abre una sesión
        // No importa el estado actual, si el cliente selecciona la mesa, debe estar ocupada
        try {
            await strapi.entityService.update('api::mesa.mesa', mesa.id, {
                data: { status: 'ocupada' },
            });
            console.log(`[openSession] ✅ Mesa ${table} FORZADA a estado 'ocupada'`);
        }
        catch (err) {
            console.error(`[openSession] ❌ ERROR CRÍTICO: No se pudo marcar mesa ${table} como ocupada:`, err);
            // Lanzar el error para que se note el problema
            throw new Error(`Failed to mark table ${table} as occupied: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
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
        console.log(`[closeSession] Request to close table ${table} for restaurant ${slug} (${restaurante.id})`);
        // 2. Buscar sesiones abiertas de ESAS mesas usando filtro profundo (Deep Filter)
        // Esto encuentra sesiones vinculadas a CUALQUIER mesa que tenga este número (incluyendo drafts, duplicados, etc)
        const openList = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                mesa: { number: Number(table) }, // Deep filter por número de mesa
                session_status: { $in: ['open', 'paid'] },
            },
            fields: ['id', 'session_status'],
            populate: { mesa: { fields: ['id', 'number'] } },
            publicationState: 'preview', // Incluir drafts por si acaso
            limit: 500,
        });
        console.log(`[closeSession] Sessions found to close for Mesa ${table} (Deep Filter):`, openList.map((s) => s.id));
        // 3. Cerrar TODAS las sesiones encontradas
        const closedIds = [];
        const failedIds = [];
        if (openList.length > 0) {
            await Promise.all(openList.map(async (sesion) => {
                console.log(`[closeSession] FORCE CLOSING session ${sesion.id}`);
                try {
                    // Update
                    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
                        data: { session_status: 'closed', closedAt: new Date() },
                    });
                    // Verification
                    const check = await strapi.entityService.findOne('api::mesa-sesion.mesa-sesion', sesion.id, {
                        fields: ['session_status']
                    });
                    if (check.session_status === 'closed') {
                        console.log(`[closeSession] Session ${sesion.id} successfully closed.`);
                        closedIds.push(sesion.id);
                    }
                    else {
                        console.error(`[closeSession] FAILED to close session ${sesion.id}. Status is still ${check.session_status}`);
                        failedIds.push(sesion.id);
                    }
                }
                catch (err) {
                    console.error(`[closeSession] Error closing session ${sesion.id}:`, err);
                    failedIds.push(sesion.id);
                }
            }));
        }
        // 4. Actualizar TODAS las mesas con ese número a 'disponible'
        // Buscamos las mesas explícitamente para actualizarlas
        const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
            filters: {
                restaurante: { id: Number(restaurante.id) },
                number: Number(table)
            },
            fields: ['id'],
            publicationState: 'preview',
        });
        const mesaIds = mesas.map((m) => m.id);
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
        console.log(`[closeSession] Hard Close completed for Table ${table}. Closed: ${closedIds.length}, Failed: ${failedIds.length}`);
        // Respuesta final con DEBUG info
        ctx.body = {
            data: {
                status: 'closed',
                message: 'Table released and sessions closed',
                debug: {
                    slug,
                    tableNumber: table,
                    restauranteId: restaurante.id,
                    sessionsFound: openList.length,
                    sessionIds: openList.map((s) => s.id),
                    closedSessionIds: closedIds,
                    failedSessionIds: failedIds,
                    clearedMesas: mesaIds.length
                }
            }
        };
    },
};
