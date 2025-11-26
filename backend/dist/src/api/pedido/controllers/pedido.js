"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/api/pedido/controllers/pedido.ts
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::pedido.pedido', ({ strapi: strapiInstance }) => ({
    /**
     * PUT /api/pedidos/:id
     * - Si :id es numérico -> actualiza por id
     * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
     */
    async update(ctx) {
        var _a, _b, _c;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
        const payload = (((_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) && ctx.request.body.data) ||
            ((_c = ctx.request) === null || _c === void 0 ? void 0 : _c.body) ||
            {};
        if (!param) {
            ctx.badRequest('Missing id param');
            return;
        }
        if (!payload || typeof payload !== 'object') {
            ctx.badRequest('Missing data');
            return;
        }
        let realId = null;
        // ¿Es un número válido?
        const maybeNumber = Number(param);
        if (Number.isFinite(maybeNumber)) {
            realId = maybeNumber;
        }
        else {
            // Tratar como documentId
            const existing = await strapiInstance.db.query('api::pedido.pedido').findOne({
                where: { documentId: param },
                select: ['id'],
            });
            if (!(existing === null || existing === void 0 ? void 0 : existing.id)) {
                ctx.notFound('Pedido no encontrado');
                return;
            }
            realId = existing.id;
        }
        const updated = await strapiInstance.entityService.update('api::pedido.pedido', realId, {
            data: payload,
        });
        ctx.body = { data: updated };
    },
}));
