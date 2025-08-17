"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/controllers/tenant.ts
const utils_1 = require("@strapi/utils");
const { ApplicationError, NotFoundError, ValidationError } = utils_1.errors;
exports.default = {
    /**
     * POST /restaurants/:slug/orders
     * Crea un Pedido e Item-Pedidos, forzando la relación 'restaurante' por slug.
     * Público por ahora (MVP). Luego se agrega policy y throttling.
     */
    async createOrder(ctx) {
        const { slug } = ctx.params || {};
        const raw = ctx.request.body;
        const data = (raw && raw.data) ? raw.data : raw || {};
        const table = data === null || data === void 0 ? void 0 : data.table;
        const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        const customerNotes = (data === null || data === void 0 ? void 0 : data.customerNotes) || '';
        const tableSessionId = (data === null || data === void 0 ? void 0 : data.tableSessionId) || null;
        if (!slug)
            throw new ValidationError('Missing restaurant slug');
        if (table === undefined || table === null || table === '')
            throw new ValidationError('Missing table');
        if (!items.length)
            throw new ValidationError('Empty items');
        // 1) Buscar restaurante por slug (solo publicados)
        const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
            filters: { slug },
            fields: ['id', 'name'],
            publicationState: 'live',
            limit: 1,
        });
        const restaurante = restaurantes === null || restaurantes === void 0 ? void 0 : restaurantes[0];
        if (!(restaurante === null || restaurante === void 0 ? void 0 : restaurante.id))
            throw new NotFoundError('Restaurante no encontrado');
        // 2) Calcular total/subtotal
        const subtotal = items.reduce((sum, it) => {
            var _a, _b, _c;
            const qty = Number((_a = it === null || it === void 0 ? void 0 : it.qty) !== null && _a !== void 0 ? _a : 0);
            const unit = Number((_c = (_b = it === null || it === void 0 ? void 0 : it.unitPrice) !== null && _b !== void 0 ? _b : it === null || it === void 0 ? void 0 : it.price) !== null && _c !== void 0 ? _c : 0);
            return sum + qty * unit;
        }, 0);
        // 3) Crear Pedido forzando relación 'restaurante'
        const pedido = await strapi.entityService.create('api::pedido.pedido', {
            data: {
                table: Number(table),
                order_status: 'pending', // mapea al enum actual: pending|preparing|served|paid
                customerNotes,
                tableSessionId,
                total: subtotal,
                restaurante: restaurante.id, // << clave: se setea en el servidor
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
};
