"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mercadopago_1 = require("mercadopago");
exports.default = {
    // ——— opcional: si ya lo tenés, podés dejarlo tal cual ———
    async createPreference(ctx) {
        var _a, _b, _c, _d, _e;
        try {
            const { items, orderId, amount, payer_email, back_urls } = ctx.request.body || {};
            const orderPk = orderId !== undefined && orderId !== null && orderId !== '' && !Number.isNaN(Number(orderId))
                ? Number(orderId)
                : null;
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                ctx.status = 500;
                ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            const hasItems = Array.isArray(items) && items.length > 0;
            const numericAmount = typeof amount === 'number' ? Number(amount) : Number.NaN;
            if (!hasItems && (!numericAmount || Number.isNaN(numericAmount))) {
                ctx.status = 400;
                ctx.body = { ok: false, error: 'Debés enviar items o amount válido (> 0).' };
                return;
            }
            const normalizedAmount = !hasItems ? Math.round(numericAmount * 100) / 100 : null;
            const saneItems = hasItems
                ? items.map((it) => {
                    var _a, _b, _c, _d, _e, _f, _g;
                    const quantity = Number((_b = (_a = it.quantity) !== null && _a !== void 0 ? _a : it.qty) !== null && _b !== void 0 ? _b : 1);
                    const unit_price = Number((_e = (_d = (_c = it.unit_price) !== null && _c !== void 0 ? _c : it.price) !== null && _d !== void 0 ? _d : it.precio) !== null && _e !== void 0 ? _e : 0);
                    const title = String((_g = (_f = it.title) !== null && _f !== void 0 ? _f : it.nombre) !== null && _g !== void 0 ? _g : 'Pedido');
                    if (!quantity || !unit_price || Number.isNaN(quantity) || Number.isNaN(unit_price)) {
                        throw new Error('quantity/unit_price inválidos (>0)');
                    }
                    return { title, quantity, unit_price, currency_id: 'ARS' };
                })
                : [
                    {
                        title: orderId ? `Pedido #${orderId}` : 'Pago',
                        quantity: 1,
                        unit_price: Number.isFinite(normalizedAmount) ? normalizedAmount : Number(numericAmount),
                        currency_id: 'ARS',
                    },
                ];
            const totalAmount = saneItems.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity || 1), 0);
            if (!totalAmount || Number.isNaN(totalAmount)) {
                ctx.status = 400;
                ctx.body = { ok: false, error: 'Monto inválido para la preferencia.' };
                return;
            }
            const baseFront = (process.env.FRONTEND_URL || 'http://127.0.0.1:5173').trim();
            const defaultSuccess = new URL('/pago/success', baseFront).toString();
            const defaultFailure = new URL('/pago/failure', baseFront).toString();
            const defaultPending = new URL('/pago/pending', baseFront).toString();
            const providedBackUrls = back_urls && typeof back_urls === 'object' ? back_urls : {};
            const backUrls = {
                success: providedBackUrls.success || defaultSuccess,
                failure: providedBackUrls.failure || defaultFailure,
                pending: providedBackUrls.pending || defaultPending,
            };
            const backendBase = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:1337').replace(/\/+$/, '');
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
            const preference = new mercadopago_1.Preference(client);
            const body = {
                items: saneItems,
                external_reference: orderId ? String(orderId) : undefined,
                back_urls: backUrls,
                auto_return: 'approved',
                notification_url: `${backendBase}/api/mercadopago/webhook`,
            };
            if (payer_email) {
                body.payer = { email: String(payer_email) };
            }
            const mpPref = await preference.create({ body });
            const paymentRecord = await strapi.entityService.create('api::payment.payment', {
                data: {
                    order: orderPk,
                    status: 'init',
                    amount: totalAmount,
                    currency_id: (_b = (_a = saneItems[0]) === null || _a === void 0 ? void 0 : _a.currency_id) !== null && _b !== void 0 ? _b : 'ARS',
                    external_reference: orderId ? String(orderId) : undefined,
                    mp_preference_id: mpPref === null || mpPref === void 0 ? void 0 : mpPref.id,
                    init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.init_point,
                    sandbox_init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.sandbox_init_point,
                    raw_preference: mpPref,
                },
            });
            ctx.body = {
                ok: true,
                preference_id: mpPref === null || mpPref === void 0 ? void 0 : mpPref.id,
                init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.init_point,
                sandbox_init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.sandbox_init_point,
                payment_id: paymentRecord === null || paymentRecord === void 0 ? void 0 : paymentRecord.id,
            };
        }
        catch (e) {
            (_d = (_c = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.call(_c, 'createPreference ERROR ->', { message: e === null || e === void 0 ? void 0 : e.message, response: (_e = e === null || e === void 0 ? void 0 : e.response) === null || _e === void 0 ? void 0 : _e.data });
            ctx.status = 500;
            ctx.body = { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || 'Error creando preferencia' };
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
