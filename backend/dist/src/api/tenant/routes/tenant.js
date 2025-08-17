"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/routes/tenant.ts
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/restaurants/:slug/orders',
            handler: 'tenant.createOrder',
            config: {
                // En MVP lo dejamos público; luego ponemos policy/ratelimit
                auth: false,
            },
        },
    ],
};
