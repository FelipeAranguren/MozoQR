"use strict";
/**
 * restaurante controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::restaurante.restaurante', ({ strapi: strapiInstance }) => ({
    /**
     * PUT /api/restaurantes/:id
     * - Si :id es numérico -> actualiza por id
     * - Si :id NO es numérico o tiene formato especial (como "12:1") -> extrae el número y actualiza
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
        // Convertir el parámetro a string para procesarlo
        const paramStr = String(param);
        // Si el parámetro contiene ":", extraer solo la parte numérica antes del ":"
        const idPart = paramStr.includes(':') ? paramStr.split(':')[0] : paramStr;
        // Intentar convertir a número
        const maybeNumber = Number(idPart);
        if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
            realId = Math.floor(maybeNumber);
        }
        else {
            // Si no es un número válido, tratar como documentId o buscar por slug
            try {
                const existing = await strapiInstance.db.query('api::restaurante.restaurante').findOne({
                    where: { documentId: paramStr },
                    select: ['id'],
                });
                if (existing === null || existing === void 0 ? void 0 : existing.id) {
                    realId = existing.id;
                }
            }
            catch (err) {
                console.error('Error buscando restaurante por documentId:', err);
            }
            if (!realId) {
                ctx.notFound('Restaurante no encontrado');
                return;
            }
        }
        const updated = await strapiInstance.entityService.update('api::restaurante.restaurante', realId, {
            data: payload,
        });
        ctx.body = { data: updated };
    },
}));
