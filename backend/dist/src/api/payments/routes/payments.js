"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/payments/routes/payments.ts
exports.default = {
    routes: [
        {
            method: 'POST',
            path: '/payments/create-preference',
            handler: 'payments.createPreference',
            config: { auth: false, policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/payments/card-pay', // ⬅️ NUEVA
            handler: 'payments.cardPay',
            config: { auth: false, policies: [], middlewares: [] },
        },
    ],
};
