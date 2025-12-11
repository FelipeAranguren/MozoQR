"use strict";
/**
 * restaurante controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::restaurante.restaurante', ({ strapi }) => ({
    // Custom update to handle documentId vs numeric ID compatibility
    async update(ctx) {
        var _a, _b, _c;
        const param = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
        const payload = (((_b = ctx.request) === null || _b === void 0 ? void 0 : _b.body) && ctx.request.body.data) ||
            ((_c = ctx.request) === null || _c === void 0 ? void 0 : _c.body) ||
            {};
        if (!param) {
            return ctx.badRequest('Missing id param');
        }
        // We typically don't fail for missing data in partial updates, but good to check specifics
        // if (!payload || typeof payload !== 'object') { ... }
        let realId = null;
        // Check if valid number
        const maybeNumber = Number(param);
        if (Number.isFinite(maybeNumber)) {
            realId = maybeNumber;
        }
        else {
            // Treat as documentId or slug
            // If your frontend sends documentId for update, we resolve it here.
            const existing = await strapi.db.query('api::restaurante.restaurante').findOne({
                where: { documentId: param },
                select: ['id'],
            });
            if (!(existing === null || existing === void 0 ? void 0 : existing.id)) {
                return ctx.notFound('Restaurante no encontrado');
            }
            realId = existing.id;
        }
        // Update using entityService
        const updated = await strapi.entityService.update('api::restaurante.restaurante', realId, {
            data: payload,
        });
        // Sanitize output (optional, core controller does this but we act manually here)
        const sanitized = await this.sanitizeOutput(updated, ctx);
        return this.transformResponse(sanitized);
    },
    // GOD MODE: Impersonate owner
    async impersonate(ctx) {
        const { email } = ctx.request.body;
        if (!email) {
            return ctx.badRequest('Email is required');
        }
        // 1. Find user by email
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { email: email.toLowerCase() }
        });
        if (!user) {
            return ctx.notFound('User not found');
        }
        // 2. Issue JWT (Requires users-permissions plugin services)
        const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
            id: user.id,
        });
        return {
            jwt,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                confirmed: user.confirmed,
                blocked: user.blocked,
                role: user.role
            },
        };
    }
}));
