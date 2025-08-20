"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/controllers/tenant.ts
const utils_1 = require("@strapi/utils");
const { ValidationError, NotFoundError } = utils_1.errors;
exports.default = {
    /**
     * POST /restaurants/:slug/orders
     * Crea un pedido para un restaurante (busca restaurante por slug),
     * luego crea sus ítems usando ids planos (REST).
     */
    async createOrder(ctx) {
        var _a, _b;
        const { slug } = ctx.params || {};
        const raw = ctx.request.body;
        const data = (raw && raw.data) ? raw.data : raw || {};
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = (_a = data === null || data === void 0 ? void 0 : data.tableSessionId) !== null && _a !== void 0 ? _a : null;
        const customerNotes = (_b = data === null || data === void 0 ? void 0 : data.customerNotes) !== null && _b !== void 0 ? _b : '';
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        if (table === undefined || table === null || table === '') {
            throw new ValidationError('Missing table');
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new ValidationError('Empty items');
        }
        // 1) Buscar restaurante por slug
        const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
            filters: { slug },
            fields: ['id', 'name'],
            publicationState: 'live',
            limit: 1,
        });
        const restaurante = restaurantes === null || restaurantes === void 0 ? void 0 : restaurantes[0];
        if (!(restaurante === null || restaurante === void 0 ? void 0 : restaurante.id))
            throw new NotFoundError('Restaurante no encontrado');
        // 2) Calcular total (si no vino del cliente)
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
        // 3) Crear pedido
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                table: Number(table),
                order_status: 'pending',
                customerNotes,
                tableSessionId,
                total,
                restaurante: restaurante.id, // relación por id plano en REST
                publishedAt: new Date(),
            },
        });
        // 4) Crear ítems (usar id plano en REST; evita 'connect')
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
        ctx.body = { data: { id: pedido.id } };
    },
    /**
     * POST /restaurants/:slug/close-account
     * Marca todos los pedidos de la mesa como pagados.
     */
    async closeAccount(ctx) {
        const { slug } = ctx.params || {};
        const raw = ctx.request.body;
        const data = (raw && raw.data) ? raw.data : raw || {};
        const table = data === null || data === void 0 ? void 0 : data.table;
        const tableSessionId = (data === null || data === void 0 ? void 0 : data.tableSessionId) || null;
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        if (table === undefined || table === null || table === '')
            throw new ValidationError('Missing table');
        // Buscar restaurante por slug
        const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
            filters: { slug },
            fields: ['id'],
            publicationState: 'live',
            limit: 1,
        });
        const restaurante = restaurantes === null || restaurantes === void 0 ? void 0 : restaurantes[0];
        if (!(restaurante === null || restaurante === void 0 ? void 0 : restaurante.id))
            throw new NotFoundError('Restaurante no encontrado');
        // Buscar pedidos pendientes de la mesa
        const filters = {
            restaurante: restaurante.id,
            table: Number(table),
            order_status: { $ne: 'paid' },
        };
        if (tableSessionId)
            filters.tableSessionId = tableSessionId;
        const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
            filters,
            fields: ['id'],
            publicationState: 'live',
        });
        const ids = (pedidos || []).map((p) => p.id);
        await Promise.all(ids.map((id) => strapi.entityService.update('api::pedido.pedido', id, {
            data: { order_status: 'paid' },
        })));
        ctx.body = { data: { paidOrders: ids.length } };
    },
};
