"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/controllers/tenant.ts
const utils_1 = require("@strapi/utils");
const { ValidationError, NotFoundError } = utils_1.errors;
/* ----------------------- Helpers ----------------------- */
async function findRestauranteBySlug(slug) {
    var _a;
    const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
        filters: { slug: { $eq: slug } },
        fields: ['id', 'name'],
        publicationState: 'live',
        limit: 1,
    });
    return (_a = restaurantes === null || restaurantes === void 0 ? void 0 : restaurantes[0]) !== null && _a !== void 0 ? _a : null;
}
async function getOrCreateMesa(restauranteId, tableNumber) {
    const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: {
            restaurante: { id: { $eq: restauranteId } },
            number: { $eq: tableNumber },
        },
        fields: ['id', 'number'],
        publicationState: 'live',
        limit: 1,
    });
    if (mesas === null || mesas === void 0 ? void 0 : mesas[0])
        return mesas[0];
    return await strapi.entityService.create('api::mesa.mesa', {
        data: {
            number: tableNumber,
            isActive: true,
            restaurante: restauranteId,
            publishedAt: new Date(),
        },
    });
}
async function getOrCreateOpenSession(restauranteId, mesaId, tableSessionCode) {
    const filters = {
        restaurante: { id: { $eq: restauranteId } },
        mesa: { id: { $eq: mesaId } },
        session_status: { $eq: 'open' },
    };
    if (tableSessionCode)
        filters.code = { $eq: tableSessionCode };
    const sesiones = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters,
        fields: ['id', 'code', 'session_status'],
        publicationState: 'live',
        limit: 1,
    });
    if (sesiones === null || sesiones === void 0 ? void 0 : sesiones[0])
        return sesiones[0];
    const sesion = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
        data: {
            code: tableSessionCode || undefined,
            session_status: 'open',
            openedAt: new Date(),
            total: 0,
            paidTotal: 0,
            mesa: mesaId,
            restaurante: restauranteId,
            publishedAt: new Date(),
        },
    });
    await strapi.entityService.update('api::mesa.mesa', mesaId, {
        data: { currentSession: sesion.id },
    });
    return sesion;
}
/* ----------------------- Controller ----------------------- */
exports.default = {
    async createOrder(ctx) {
        var _a, _b;
        const { slug } = ctx.params || {};
        const raw = ctx.request.body || {};
        const data = (raw && raw.data) ? raw.data : raw;
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = (_a = data === null || data === void 0 ? void 0 : data.tableSessionId) !== null && _a !== void 0 ? _a : null;
        const customerNotes = (_b = data === null || data === void 0 ? void 0 : data.customerNotes) !== null && _b !== void 0 ? _b : '';
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        if (!items.length)
            throw new ValidationError('Empty items');
        const restaurante = await findRestauranteBySlug(slug);
        if (!(restaurante === null || restaurante === void 0 ? void 0 : restaurante.id))
            throw new NotFoundError('Restaurante no encontrado');
        // 👇 casteamos ids a number
        const mesa = await getOrCreateMesa(Number(restaurante.id), Number(table)); // 👈
        const sesion = await getOrCreateOpenSession(Number(restaurante.id), Number(mesa.id), tableSessionId); // 👈
        const calcTotal = (arr) => arr.reduce((s, it) => {
            var _a, _b, _c;
            const q = Number((_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : 0);
            const p = Number((_c = (_b = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _b !== void 0 ? _b : it === null || it === void 0 ? void 0 : it.price) !== null && _c !== void 0 ? _c : 0);
            const line = q * p;
            return s + (Number.isFinite(line) ? line : 0);
        }, 0);
        const total = (data === null || data === void 0 ? void 0 : data.total) !== undefined && (data === null || data === void 0 ? void 0 : data.total) !== null && (data === null || data === void 0 ? void 0 : data.total) !== ''
            ? Number(data.total)
            : calcTotal(items);
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                order_status: 'pending',
                customerNotes,
                total,
                mesa_sesion: sesion.id,
                restaurante: restaurante.id,
                publishedAt: new Date(),
            },
        });
        await Promise.all(items.map((it) => {
            var _a, _b, _c, _d;
            const quantity = Number((_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : 0);
            const unit = Number((_c = (_b = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _b !== void 0 ? _b : it === null || it === void 0 ? void 0 : it.price) !== null && _c !== void 0 ? _c : 0);
            const productId = Number((_d = it === null || it === void 0 ? void 0 : it.productId) !== null && _d !== void 0 ? _d : it === null || it === void 0 ? void 0 : it.id);
            if (!productId)
                throw new ValidationError('Item without productId');
            return strapi.entityService.create('api::item-pedido.item-pedido', {
                data: {
                    quantity,
                    notes: (it === null || it === void 0 ? void 0 : it.notes) || '',
                    UnitPrice: unit,
                    totalPrice: quantity * unit,
                    order: pedido.id,
                    product: productId,
                    publishedAt: new Date(),
                },
            });
        }));
        const pedidosDeSesion = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: { mesa_sesion: { id: { $eq: sesion.id } } },
            fields: ['id', 'total'],
            publicationState: 'live',
            limit: 500,
        });
        const nuevoTotal = (pedidosDeSesion || []).reduce((s, p) => s + Number(p.total || 0), 0);
        await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
            data: { total: nuevoTotal },
        });
        ctx.body = { data: { id: pedido.id, mesaSesionId: sesion.id } };
    },
    async closeAccount(ctx) {
        const { slug } = ctx.params || {};
        const raw = ctx.request.body || {};
        const data = (raw && raw.data) ? raw.data : raw;
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = (data === null || data === void 0 ? void 0 : data.tableSessionId) || null;
        if (table === undefined || table === null || table === '')
            throw new ValidationError('Missing table');
        const restaurante = await findRestauranteBySlug(slug);
        if (!(restaurante === null || restaurante === void 0 ? void 0 : restaurante.id))
            throw new NotFoundError('Restaurante no encontrado');
        const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
            filters: {
                restaurante: { id: { $eq: Number(restaurante.id) } },
                number: { $eq: Number(table) },
            },
            fields: ['id'],
            publicationState: 'live',
            limit: 1,
        });
        const mesa = mesas === null || mesas === void 0 ? void 0 : mesas[0];
        if (!(mesa === null || mesa === void 0 ? void 0 : mesa.id))
            throw new NotFoundError('Mesa no encontrada');
        const sesFilters = {
            restaurante: { id: { $eq: Number(restaurante.id) } },
            mesa: { id: { $eq: Number(mesa.id) } },
            session_status: { $eq: 'open' },
        };
        if (tableSessionId)
            sesFilters.code = { $eq: tableSessionId };
        const sesiones = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
            filters: sesFilters,
            fields: ['id'],
            publicationState: 'live',
            limit: 1,
        });
        const sesion = sesiones === null || sesiones === void 0 ? void 0 : sesiones[0];
        if (!(sesion === null || sesion === void 0 ? void 0 : sesion.id)) {
            ctx.body = { data: { paidOrders: 0, message: 'No open session' } };
            return;
        }
        const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: {
                mesa_sesion: { id: { $eq: sesion.id } },
                order_status: { $ne: 'paid' },
            },
            fields: ['id', 'total'],
            publicationState: 'live',
            limit: 500,
        });
        const ids = (pedidos || []).map((p) => p.id);
        await Promise.all(ids.map((id) => strapi.entityService.update('api::pedido.pedido', id, {
            data: { order_status: 'paid' },
        })));
        const totalPagado = (pedidos || []).reduce((s, p) => s + Number(p.total || 0), 0);
        await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
            data: { session_status: 'closed', closedAt: new Date(), paidTotal: totalPagado },
        });
        await strapi.entityService.update('api::mesa.mesa', Number(mesa.id), { data: { currentSession: null } });
        ctx.body = { data: { paidOrders: ids.length, mesaSesionId: sesion.id } };
    },
};
