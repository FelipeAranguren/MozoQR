"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ env }) => ({
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    // URL pública para generar correctamente los redirects de /api/connect/*
    url: env('PUBLIC_URL', 'http://localhost:1337'),
    // Si más adelante usás Nginx/Heroku/Render, podés activar esto:
    proxy: env.bool('PROXY', false),
    app: {
        keys: env.array('APP_KEYS'),
    },
});
