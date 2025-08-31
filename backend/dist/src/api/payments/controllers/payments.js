"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mercadopago_1 = require("mercadopago");
exports.default = {
    // ——— opcional: si ya lo tenés, podés dejarlo tal cual ———
    async createPreference(ctx) {
        var _a, _b, _c;
        try {
            const { items, orderId } = ctx.request.body || {};
            if (!process.env.MP_ACCESS_TOKEN) {
                ctx.status = 500;
                ctx.body = { error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            if (!Array.isArray(items) || items.length === 0) {
                ctx.status = 400;
                ctx.body = { error: 'Items requeridos' };
                return;
            }
            const saneItems = items.map((it) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const quantity = Number((_b = (_a = it.quantity) !== null && _a !== void 0 ? _a : it.qty) !== null && _b !== void 0 ? _b : 1);
                const unit_price = Number((_e = (_d = (_c = it.unit_price) !== null && _c !== void 0 ? _c : it.price) !== null && _d !== void 0 ? _d : it.precio) !== null && _e !== void 0 ? _e : 0);
                const title = String((_g = (_f = it.title) !== null && _f !== void 0 ? _f : it.nombre) !== null && _g !== void 0 ? _g : 'Pedido');
                if (!quantity || !unit_price || Number.isNaN(quantity) || Number.isNaN(unit_price)) {
                    throw new Error('quantity/unit_price inválidos (>0)');
                }
                return { title, quantity, unit_price, currency_id: 'ARS' };
            });
            const baseFront = (process.env.FRONTEND_URL || 'http://127.0.0.1:5173').trim();
            const successUrl = new URL('/pago/success', baseFront).toString();
            const failureUrl = new URL('/pago/failure', baseFront).toString();
            const pendingUrl = new URL('/pago/pending', baseFront).toString();
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
            const preference = new mercadopago_1.Preference(client);
            const body = {
                items: saneItems,
                external_reference: String(orderId || ''),
                back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
                auto_return: 'approved',
            };
            const mpPref = await preference.create({ body });
            ctx.body = { init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.init_point, id: mpPref === null || mpPref === void 0 ? void 0 : mpPref.id };
        }
        catch (e) {
            (_b = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, 'createPreference ERROR ->', { message: e === null || e === void 0 ? void 0 : e.message, response: (_c = e === null || e === void 0 ? void 0 : e.response) === null || _c === void 0 ? void 0 : _c.data });
            ctx.status = 500;
            ctx.body = { error: (e === null || e === void 0 ? void 0 : e.message) || 'Error creando preferencia' };
        }
    },
    // ——— NUEVO: pago con tarjeta (Card Payment Brick) ———
    async cardPay(ctx) {
        var _a, _b, _c, _d, _e;
        try {
            const { token, // token de la tarjeta (lo manda el Brick)
            issuer_id, // opcional
            payment_method_id, // ej. 'visa'
            transaction_amount, // monto total (number)
            installments, // cuotas (number)
            payer, // { email, identification? }
            description, // ej. 'Pedido...'
            orderId, // tu referencia
             } = ctx.request.body || {};
            if (!process.env.MP_ACCESS_TOKEN) {
                ctx.status = 500;
                ctx.body = { error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            // Validaciones mínimas
            if (!token) {
                ctx.status = 400;
                ctx.body = { error: 'Falta token' };
                return;
            }
            const amount = Number(transaction_amount);
            if (!amount || Number.isNaN(amount)) {
                ctx.status = 400;
                ctx.body = { error: 'Monto inválido' };
                return;
            }
            const email = payer === null || payer === void 0 ? void 0 : payer.email;
            if (!email) {
                ctx.status = 400;
                ctx.body = { error: 'Falta payer.email' };
                return;
            }
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
            const payment = new mercadopago_1.Payment(client);
            const mpRes = await payment.create({
                body: {
                    transaction_amount: amount,
                    token,
                    description: description || 'Pago con tarjeta',
                    installments: Number(installments || 1),
                    payment_method_id,
                    issuer_id,
                    capture: true,
                    external_reference: String(orderId || ''),
                    payer: {
                        email,
                        identification: payer === null || payer === void 0 ? void 0 : payer.identification, // opcional { type, number }
                    },
                },
            });
            ctx.body = {
                id: mpRes === null || mpRes === void 0 ? void 0 : mpRes.id,
                status: mpRes === null || mpRes === void 0 ? void 0 : mpRes.status, // approved | in_process | rejected
                status_detail: mpRes === null || mpRes === void 0 ? void 0 : mpRes.status_detail,
            };
        }
        catch (e) {
            (_b = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, 'cardPay ERROR ->', { message: e === null || e === void 0 ? void 0 : e.message, response: (_c = e === null || e === void 0 ? void 0 : e.response) === null || _c === void 0 ? void 0 : _c.data });
            ctx.status = 500;
            ctx.body = { error: (e === null || e === void 0 ? void 0 : e.message) || 'Error procesando pago', details: (_e = (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.data) !== null && _e !== void 0 ? _e : null };
        }
    },
};
