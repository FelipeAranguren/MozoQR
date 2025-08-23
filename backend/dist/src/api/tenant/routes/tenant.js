"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/routes/tenant.ts
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/restaurants/:slug/orders',
            handler: 'tenant.createOrder',
            config: { auth: false },
        },
        {
            method: 'POST',
            path: '/restaurants/:slug/close-account',
            handler: 'tenant.closeAccount',
            config: { auth: false },
        },
        {
            method: 'PUT',
            path: '/restaurants/:slug/close-account',
            handler: 'tenant.closeAccount',
            config: { auth: false },
        },
    ],
};
