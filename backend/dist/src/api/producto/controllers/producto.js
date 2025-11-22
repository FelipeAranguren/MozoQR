"use strict";
/**
 * producto controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
// Helper para resolver el ID real (numérico o documentId)
async function resolveProductId(strapi, param) {
    if (!param)
        return null;
    // ¿Es un número válido?
    const maybeNumber = Number(param);
    if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
        return maybeNumber;
    }
    // Tratar como documentId
    const existing = await strapi.db.query('api::producto.producto').findOne({
        where: { documentId: param },
        select: ['id'],
    });
    return (existing === null || existing === void 0 ? void 0 : existing.id) || null;
}
exports.default = strapi_1.factories.createCoreController('api::producto.producto', ({ strapi }) => ({
    /**
     * PUT /api/productos/:id
     * - Si :id es numérico -> actualiza por id
     * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
     */
    async update(ctx) {
        var _a, _b, _c, _d;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
        const payload = ((_c = (_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) === null || _c === void 0 ? void 0 : _c.data) || ((_d = ctx.request) === null || _d === void 0 ? void 0 : _d.body) || {};
        if (!param) {
            ctx.badRequest('Missing id param');
            return;
        }
        const realId = await resolveProductId(strapi, param);
        if (!realId) {
            ctx.notFound('Producto no encontrado');
            return;
        }
        const updated = await strapi.entityService.update('api::producto.producto', realId, {
            data: payload,
        });
        ctx.body = { data: updated };
    },
    /**
     * DELETE /api/productos/:id
     * - Si :id es numérico -> elimina por id
     * - Si :id NO es numérico -> asume que es documentId y resuelve el id real
     */
    async delete(ctx) {
        var _a;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
        if (!param) {
            ctx.badRequest('Missing id param');
            return;
        }
        const realId = await resolveProductId(strapi, param);
        if (!realId) {
            ctx.notFound('Producto no encontrado');
            return;
        }
        const deleted = await strapi.entityService.delete('api::producto.producto', realId);
        ctx.body = { data: deleted };
    },
}));
