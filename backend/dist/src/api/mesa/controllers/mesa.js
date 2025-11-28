"use strict";
/**
 * mesa controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::mesa.mesa', ({ strapi }) => ({
    async find(ctx) {
        // Allow authenticated users to find tables
        // Ideally we should filter by the user's restaurant, but for now we trust the query filters
        // provided by the frontend, ensuring at least they are logged in.
        if (!ctx.state.user) {
            return ctx.unauthorized('You must be logged in to view tables');
        }
        // Call the default core action
        const { data, meta } = await super.find(ctx);
        return { data, meta };
    },
}));
