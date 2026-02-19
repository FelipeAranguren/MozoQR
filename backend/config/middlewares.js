// backend/config/middlewares.js
'use strict';

module.exports = [
'strapi::errors',
{
name: 'strapi::security',
config: {
contentSecurityPolicy: {
useDefaults: true,
directives: {
'connect-src': ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
},
},
},
},
{
name: 'strapi::cors',
config: {
origin: (process.env.CORS_ORIGINS || '')
.split(',')
.map(s => s.trim()),
methods: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'],
headers: ['Content-Type','Authorization','Idempotency-Key'],
keepHeadersOnError: true,
credentials: true,
},
},
'strapi::poweredBy',
'strapi::logger',
'strapi::query',
'strapi::body',
{ name: 'global::session-behind-proxy' },
{
name: 'strapi::session',
config: {
// Debe ser false detrás de proxy (Railway): el proxy termina HTTPS y Node recibe HTTP
secure: false,
sameSite: 'none',
},
},
{ name: 'global::secure-headers' },
{ name: 'global::rate-limit' },
{ name: 'global::audit-log' },
{ name: 'global::idempotency-orders' },
'strapi::favicon',
'strapi::public',
];