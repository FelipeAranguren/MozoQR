"use strict";
/**
 * categoria router
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/categorias',
            handler: 'categoria.find',
            config: {
                policies: [],
                middlewares: []
            },
        },
        {
            method: 'GET',
            path: '/categorias/:id',
            handler: 'categoria.findOne',
            config: {
                policies: [],
                middlewares: []
            },
        },
        {
            method: 'POST',
            path: '/categorias',
            handler: 'categoria.create',
            config: {
                policies: [],
                middlewares: []
            },
        },
        {
            method: 'PUT',
            path: '/categorias/:id',
            handler: 'categoria.update',
            config: {
                policies: [],
                middlewares: []
            },
        },
        {
            method: 'DELETE',
            path: '/categorias/:id',
            handler: 'categoria.delete',
            config: {
                policies: [],
                middlewares: []
            },
        },
    ],
};
