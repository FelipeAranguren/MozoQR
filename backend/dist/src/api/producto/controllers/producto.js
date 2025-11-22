"use strict";
/**
 * producto controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::producto.producto', ({ strapi }) => ({
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
        let realId = null;
        // ¿Es un número válido?
        const maybeNumber = Number(param);
        if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
            realId = maybeNumber;
        }
        else {
            // Tratar como documentId
            const existing = await strapi.db.query('api::producto.producto').findOne({
                where: { documentId: param },
                select: ['id'],
            });
            if (!(existing === null || existing === void 0 ? void 0 : existing.id)) {
                ctx.notFound('Producto no encontrado');
                return;
            }
            realId = existing.id;
        }
        const deleted = await strapi.entityService.delete('api::producto.producto', realId);
        ctx.body = { data: deleted };
    },
}));
