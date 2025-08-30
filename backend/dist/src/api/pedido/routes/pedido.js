"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/api/pedido/routes/pedido.ts
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/pedidos',
            handler: 'pedido.find',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'GET',
            path: '/pedidos/:id',
            handler: 'pedido.findOne',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/pedidos',
            handler: 'pedido.create',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'PUT',
            path: '/pedidos/:id',
            handler: 'pedido.update',
            config: { policies: [], middlewares: [] },
        },
        {
            method: 'DELETE',
            path: '/pedidos/:id',
            handler: 'pedido.delete',
            config: { policies: [], middlewares: [] },
        },
    ],
};
