"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/api/tenant/routes/tenant.ts
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/restaurants/:slug/orders',
            handler: 'tenant.createOrder',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/restaurants/:slug/close-account',
            handler: 'tenant.closeAccount',
            config: { policies: [], middlewares: [] },
        },
        // opcional: permitir cerrar cuenta también con PUT
        {
            method: 'PUT',
            path: '/restaurants/:slug/close-account',
            handler: 'tenant.closeAccount',
            config: { policies: [], middlewares: [] },
        },
    ],
};
