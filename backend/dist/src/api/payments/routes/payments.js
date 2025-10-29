"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/payments/ping',
            handler: 'payments.ping',
            config: { auth: false, policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/payments/create-preference',
            handler: 'payments.createPreference',
            config: { auth: false, policies: [], middlewares: [] },
        },
        {
            method: 'POST',
            path: '/payments/card-pay',
            handler: 'payments.cardPay',
            config: { auth: false, policies: [], middlewares: [] },
        },
        {
            method: 'GET',
            path: '/payments/confirm',
            handler: 'payments.confirm',
            config: { auth: false, policies: [], middlewares: [] },
        }
        // Si luego agregás webhook, sumá aquí:
        // {
        //   method: 'POST',
        //   path: '/payments/webhook',
        //   handler: 'payments.webhook',
        //   config: { auth: false },
        // },
    ],
};
