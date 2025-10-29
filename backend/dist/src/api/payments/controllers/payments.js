"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//backend/src/api/payments/controllers/payments.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const mercadopago_1 = require("mercadopago");
function ensureHttpUrl(u, fallback = 'http://localhost:5173') {
    const s = String(u || '').trim();
    if (!s)
        return fallback;
    if (!/^https?:\/\//i.test(s))
        return `http://${s.replace(/^\/*/, '')}`;
    return s;
}
function resolvePaymentUID() {
    // Soporta ambos UIDs según cómo hayas creado el CT
    const uid1 = 'api::payment.payment';
    const uid2 = 'api::payments.payment';
    // @ts-ignore
    const has1 = !!((strapi === null || strapi === void 0 ? void 0 : strapi.contentTypes) && strapi.contentTypes[uid1]);
    // @ts-ignore
    const has2 = !!((strapi === null || strapi === void 0 ? void 0 : strapi.contentTypes) && strapi.contentTypes[uid2]);
    if (has1)
        return uid1;
    if (has2)
        return uid2;
    return null;
}
exports.default = {
    async ping(ctx) {
        ctx.body = { ok: true, msg: 'payments api up' };
    },
    async createPreference(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const { items, orderId, amount, payer_email, back_urls } = ctx.request.body || {};
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                ctx.status = 500;
                ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            // ---- Normalización de monto/ítems
            const hasItems = Array.isArray(items) && items.length > 0;
            const numericAmount = typeof amount === 'number' ? Number(amount) : Number.NaN;
            if (!hasItems && (!numericAmount || Number.isNaN(numericAmount))) {
                ctx.status = 400;
                ctx.body = { ok: false, error: 'Debés enviar items o amount (> 0).' };
                return;
            }
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
                        unit_price: Math.round(Number(numericAmount) * 100) / 100,
                        currency_id: 'ARS',
                    },
                ];
            const totalAmount = saneItems.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity || 1), 0);
            // ---- back_urls en HTTP local (sin auto_return)
            const baseFront = ensureHttpUrl(process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
            const provided = (back_urls && typeof back_urls === 'object') ? back_urls : {};
            const success = ensureHttpUrl(provided.success || `${baseFront}/pago/success`) + `?orderId=${encodeURIComponent(orderId !== null && orderId !== void 0 ? orderId : '')}`;
            const failure = ensureHttpUrl(provided.failure || `${baseFront}/pago/failure`) + `?orderId=${encodeURIComponent(orderId !== null && orderId !== void 0 ? orderId : '')}`;
            const pending = ensureHttpUrl(provided.pending || `${baseFront}/pago/pending`) + `?orderId=${encodeURIComponent(orderId !== null && orderId !== void 0 ? orderId : '')}`;
            const backUrls = { success, failure, pending };
            // ---- Crear preferencia
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
            const preference = new mercadopago_1.Preference(client);
            const mpPref = await preference.create({
                body: {
                    items: saneItems.map((it, i) => ({ id: String(i + 1), ...it })),
                    external_reference: orderId ? String(orderId) : undefined,
                    back_urls: backUrls,
                    // auto_return: 'approved',  // activalo si servís el front por HTTPS
                },
            });
            // ---- Persistencia best-effort (no romper si falla)
            let paymentId = null;
            try {
                const paymentUID = resolvePaymentUID(); // <- detecta el UID correcto
                if (paymentUID) {
                    const orderPk = orderId !== undefined && orderId !== null && orderId !== '' && !Number.isNaN(Number(orderId))
                        ? Number(orderId)
                        : null;
                    const created = await strapi.entityService.create(paymentUID, {
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
                    paymentId = (created && typeof created === 'object' && 'id' in created) ? created.id : null;
                }
                else {
                    (_d = (_c = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _c === void 0 ? void 0 : _c.warn) === null || _d === void 0 ? void 0 : _d.call(_c, '[payments] No se encontró CT payment ni payments — salto persistencia');
                }
            }
            catch (persistErr) {
                (_f = (_e = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _e === void 0 ? void 0 : _e.warn) === null || _f === void 0 ? void 0 : _f.call(_e, '[payments] Persistencia fallida (continuo): ' + ((persistErr === null || persistErr === void 0 ? void 0 : persistErr.message) || persistErr));
            }
            ctx.body = {
                ok: true,
                preference_id: mpPref === null || mpPref === void 0 ? void 0 : mpPref.id,
                init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.init_point,
                sandbox_init_point: mpPref === null || mpPref === void 0 ? void 0 : mpPref.sandbox_init_point,
                payment_id: paymentId,
            };
        }
        catch (e) {
            (_h = (_g = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _g === void 0 ? void 0 : _g.error) === null || _h === void 0 ? void 0 : _h.call(_g, 'createPreference ERROR ->', ((_j = e === null || e === void 0 ? void 0 : e.response) === null || _j === void 0 ? void 0 : _j.data) || (e === null || e === void 0 ? void 0 : e.message));
            ctx.status = 500;
            ctx.body = { ok: false, error: (_m = (_l = (_k = e === null || e === void 0 ? void 0 : e.response) === null || _k === void 0 ? void 0 : _k.data) !== null && _l !== void 0 ? _l : e === null || e === void 0 ? void 0 : e.message) !== null && _m !== void 0 ? _m : 'Error creando preferencia' };
        }
    },
    async cardPay(ctx) {
        var _a, _b, _c, _d, _e;
        try {
            const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, description, orderId } = ctx.request.body || {};
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                ctx.status = 500;
                ctx.body = { error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
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
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
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
                    payer: { email, identification: payer === null || payer === void 0 ? void 0 : payer.identification },
                },
            });
            ctx.body = { id: mpRes === null || mpRes === void 0 ? void 0 : mpRes.id, status: mpRes === null || mpRes === void 0 ? void 0 : mpRes.status, status_detail: mpRes === null || mpRes === void 0 ? void 0 : mpRes.status_detail };
        }
        catch (e) {
            (_b = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, 'cardPay ERROR ->', ((_c = e === null || e === void 0 ? void 0 : e.response) === null || _c === void 0 ? void 0 : _c.data) || (e === null || e === void 0 ? void 0 : e.message));
            ctx.status = 500;
            ctx.body = { error: (e === null || e === void 0 ? void 0 : e.message) || 'Error procesando pago', details: (_e = (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.data) !== null && _e !== void 0 ? _e : null };
        }
    },
    // Confirmar pago al volver del redirect (sin webhook)
    async confirm(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            const { preference_id, payment_id } = ctx.request.query || {};
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                ctx.status = 500;
                ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            // 1) Obtener el pago o merchant_order y recuperar external_reference (== orderId)
            // Usamos SDK v2:
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
            let orderId = null;
            let status = null;
            if (payment_id) {
                const p = new mercadopago_1.Payment(client);
                const r = await p.get({ id: String(payment_id) });
                orderId = (_c = (_a = r === null || r === void 0 ? void 0 : r.external_reference) !== null && _a !== void 0 ? _a : (_b = r === null || r === void 0 ? void 0 : r.metadata) === null || _b === void 0 ? void 0 : _b.order_id) !== null && _c !== void 0 ? _c : null;
                status = (_d = r === null || r === void 0 ? void 0 : r.status) !== null && _d !== void 0 ? _d : null;
            }
            if (!orderId && preference_id) {
                // fallback: consultá la preferencia y su external_reference
                const pref = new mercadopago_1.Preference(client);
                const pr = await pref.get({ preferenceId: String(preference_id) });
                orderId = (_e = pr === null || pr === void 0 ? void 0 : pr.external_reference) !== null && _e !== void 0 ? _e : null;
                // status lo podríamos buscar listando pagos por preference, pero no hace falta si llegó aquí desde "approved"
                status = status || 'approved';
            }
            if (!orderId) {
                ctx.status = 400;
                ctx.body = { ok: false, error: 'No se pudo determinar orderId (external_reference)' };
                return;
            }
            // 2) Marcar el pedido como pagado en tu BD
            // ADAPTA estas líneas a tu esquema real.
            // Intento 1: campo booleano "paid"
            const PUID = 'api::pedido.pedido';
            try {
                await strapi.entityService.update(PUID, Number(orderId), {
                    data: { paid: true, payment_status: status || 'approved' },
                });
            }
            catch {
                // Intento 2: campo "status"
                try {
                    await strapi.entityService.update(PUID, Number(orderId), {
                        data: { status: 'paid' },
                    });
                }
                catch (e) {
                    (_g = (_f = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _f === void 0 ? void 0 : _f.warn) === null || _g === void 0 ? void 0 : _g.call(_f, '[payments.confirm] no pude actualizar el pedido, adaptá los campos a tu esquema');
                }
            }
            ctx.body = { ok: true, orderId, status: status || 'approved' };
        }
        catch (e) {
            (_j = (_h = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _h === void 0 ? void 0 : _h.error) === null || _j === void 0 ? void 0 : _j.call(_h, '[payments.confirm] ', ((_k = e === null || e === void 0 ? void 0 : e.response) === null || _k === void 0 ? void 0 : _k.data) || (e === null || e === void 0 ? void 0 : e.message));
            ctx.status = 500;
            ctx.body = { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || 'Error confirmando pago' };
        }
    },
};
