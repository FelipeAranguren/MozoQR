"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom tenant controller
 * Endpoints:
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
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
/** Crea (si no existe) o devuelve la Mesa (por restaurante + number) */
async function getOrCreateMesa(restauranteId, number) {
    var _a;
    const found = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: { restaurante: { id: Number(restauranteId) }, number },
        fields: ['id', 'number'],
        limit: 1,
    });
    if ((_a = found === null || found === void 0 ? void 0 : found[0]) === null || _a === void 0 ? void 0 : _a.id)
        return found[0];
    return await strapi.entityService.create('api::mesa.mesa', {
        data: {
            number,
            isActive: true,
            restaurante: restauranteId,
            publishedAt: new Date(),
        },
    });
}
/**
 * Devuelve la sesión ABIERTA para esa mesa.
 * Estrategia: primero buscar una 'open' por (restaurante, mesa).
 * Si no hay, crear una nueva (code autogenerado).
 * Ignoramos 'code' para reutilizar por robustez (evita “primer pedido sin sesión”).
 */
async function getOrCreateOpenSession(opts) {
    var _a;
    const { restauranteId, mesaId } = opts;
    // 1) Buscar sesión abierta existente (única por mesa)
    const existingOpen = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: {
            restaurante: { id: Number(restauranteId) },
            mesa: { id: Number(mesaId) },
            session_status: 'open',
        },
        fields: ['id', 'code', 'session_status', 'openedAt'],
        sort: ['openedAt:desc', 'createdAt:desc'],
        limit: 1,
    });
    if ((_a = existingOpen === null || existingOpen === void 0 ? void 0 : existingOpen[0]) === null || _a === void 0 ? void 0 : _a.id)
        return existingOpen[0];
    // 2) Crear una nueva
    const newCode = Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);
    return await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
        data: {
            code: newCode,
            session_status: 'open',
            openedAt: new Date(),
            restaurante: { id: Number(restauranteId) }, // <= así
            mesa: { id: Number(mesaId) }, // <= así
            publishedAt: new Date(),
        },
    });
}
/** Crea los ítems de un pedido (ids planos) */
async function createItems(pedidoId, items) {
    await Promise.all((items || []).map((it) => {
        var _a, _b, _c, _d, _e;
        const quantity = Number((_b = (_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : it === null || it === void 0 ? void 0 : it.quantity) !== null && _b !== void 0 ? _b : 0);
        const unitPrice = Number((_d = (_c = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _c !== void 0 ? _c : it === null || it === void 0 ? void 0 : it.price) !== null && _d !== void 0 ? _d : 0);
        const total = Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0;
        const productId = Number((_e = it === null || it === void 0 ? void 0 : it.productId) !== null && _e !== void 0 ? _e : it === null || it === void 0 ? void 0 : it.id);
        if (!productId)
            throw new ValidationError('Item sin productId');
        return strapi.entityService.create('api::item-pedido.item-pedido', {
            data: {
                quantity,
                notes: (it === null || it === void 0 ? void 0 : it.notes) || '',
                UnitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
                totalPrice: total,
                order: pedidoId,
                product: productId,
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
                data: { currentSession: null },
            });
        }
        catch {
            // opcional: si no existe el campo, ignorar
        }
        ctx.body = { data: { paidOrders: ids.length } };
    },
};
