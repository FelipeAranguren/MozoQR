"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/payments/controllers/payments.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const mercadopago_1 = require("mercadopago");
const urls_1 = require("../../../config/urls");
function resolvePaymentUID() {
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
// Intenta marcar el pedido como "paid" con el campo que exista
async function markOrderPaid(orderPk) {
    var _a, _b;
    const ORDER_UID = 'api::pedido.pedido';
    const tries = [
        { data: { order_status: 'paid' } },
        { data: { status: 'paid' } },
        { data: { estado: 'paid' } },
        { data: { paid: true } },
    ];
    for (const t of tries) {
        try {
            await strapi.entityService.update(ORDER_UID, orderPk, t);
            return true;
        }
        catch (_err) {
            /* sigue intentando */
        }
    }
    (_b = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.call(_a, `[payments] No pude marcar pedido ${orderPk} como pagado. Ningún campo coincidió (order_status/status/estado/paid).`);
    return false;
}
// Busca el pedido por varios caminos
async function resolveOrderPk(ref) {
    if (ref == null)
        return null;
    const ORDER_UID = 'api::pedido.pedido';
    const refStr = String(ref).trim();
    // 1) id numérico
    if (/^\d+$/.test(refStr)) {
        try {
            const existing = await strapi.entityService.findOne(ORDER_UID, Number(refStr), { fields: ['id'] });
            if (existing === null || existing === void 0 ? void 0 : existing.id)
                return existing.id;
        }
        catch { }
    }
    // 2) documentId (Strapi v4 uid de documento)
    try {
        const byDocument = await strapi.db.query(ORDER_UID).findOne({
            where: { documentId: refStr },
            select: ['id'],
        });
        if (byDocument === null || byDocument === void 0 ? void 0 : byDocument.id)
            return byDocument.id;
    }
    catch { }
    return null;
}
// Construye back_urls que pasan por el backend y le envían también orderRef
function buildBackendBackUrls(orderId, strapiConfig) {
    const baseFront = (0, urls_1.getFrontendUrl)().replace(/\/*$/, '');
    const baseBack = (0, urls_1.getBackendUrl)(strapiConfig).replace(/\/*$/, '');
    const encOrder = encodeURIComponent(orderId !== null && orderId !== void 0 ? orderId : '');
    const successFront = `${baseFront}/pago/success?orderId=${encOrder}`;
    const failureFront = `${baseFront}/pago/failure?orderId=${encOrder}`;
    const pendingFront = `${baseFront}/pago/pending?orderId=${encOrder}`;
    const wrap = (destFront) => 
    // Agrego orderRef para fallback si MP no me da external_reference
    `${baseBack}/api/payments/confirm?redirect=${encodeURIComponent(destFront)}&orderRef=${encOrder}`;
    return {
        success: wrap(successFront),
        failure: wrap(failureFront),
        pending: wrap(pendingFront),
    };
}
exports.default = {
    async ping(ctx) {
        ctx.body = { ok: true, msg: 'payments api up' };
    },
    async createPreference(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            const { items, orderId, amount } = ctx.request.body || {};
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
            // ---- back_urls: forzamos a pasar por el backend (confirm) y le mandamos orderRef
            const backUrls = buildBackendBackUrls(orderId, strapi.config);
            // ---- Crear preferencia
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
            const preference = new mercadopago_1.Preference(client);
            const baseBack = (0, urls_1.getBackendUrl)(strapi.config);
            const body = {
                items: saneItems.map((it, i) => ({ id: String(i + 1), ...it })),
                external_reference: orderId ? String(orderId) : undefined,
                back_urls: backUrls,
            };
            if ((0, urls_1.isHttps)(baseBack))
                body.auto_return = 'approved';
            const mpPref = await preference.create({ body });
            // ---- Persistencia best-effort
            let paymentId = null;
            try {
                const paymentUID = resolvePaymentUID();
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        try {
            const q = ctx.request.query || {};
            const paymentIdQ = (_a = q.payment_id) !== null && _a !== void 0 ? _a : q.collection_id;
            const preferenceIdQ = (_b = q.preference_id) !== null && _b !== void 0 ? _b : q.preference_id;
            const statusQ = ((_d = (_c = q.status) !== null && _c !== void 0 ? _c : q.collection_status) !== null && _d !== void 0 ? _d : '').toString().toLowerCase() || null;
            const orderRefQ = ((_e = q.orderRef) !== null && _e !== void 0 ? _e : '').toString() || null; // <- fallback extra que nosotros pasamos
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                ctx.status = 500;
                ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
                return;
            }
            const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
            let orderRef = orderRefQ; // start with our own hint
            let status = statusQ;
            let rawPayment = null;
            // 1) Si hay payment_id/collection_id, consulto Payment API
            if (paymentIdQ) {
                try {
                    const payment = new mercadopago_1.Payment(client);
                    const mpPayment = await payment.get({ id: String(paymentIdQ) });
                    rawPayment = mpPayment;
                    // si MP trae external_reference, pisa nuestro hint
                    orderRef = (_h = (_f = mpPayment === null || mpPayment === void 0 ? void 0 : mpPayment.external_reference) !== null && _f !== void 0 ? _f : (_g = mpPayment === null || mpPayment === void 0 ? void 0 : mpPayment.metadata) === null || _g === void 0 ? void 0 : _g.order_id) !== null && _h !== void 0 ? _h : orderRef;
                    status = ((_k = ((_j = mpPayment === null || mpPayment === void 0 ? void 0 : mpPayment.status) !== null && _j !== void 0 ? _j : status)) === null || _k === void 0 ? void 0 : _k.toLowerCase()) || null;
                }
                catch (err) {
                    (_m = (_l = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _l === void 0 ? void 0 : _l.warn) === null || _m === void 0 ? void 0 : _m.call(_l, `[payments.confirm] No pude obtener payment ${paymentIdQ}: ${err === null || err === void 0 ? void 0 : err.message}`);
                }
            }
            // 2) Fallback por preference_id si aún no tengo orderRef
            if (!orderRef && preferenceIdQ) {
                try {
                    const preference = new mercadopago_1.Preference(client);
                    const mpPref = await preference.get({ preferenceId: String(preferenceIdQ) });
                    orderRef = (_o = mpPref === null || mpPref === void 0 ? void 0 : mpPref.external_reference) !== null && _o !== void 0 ? _o : null;
                    status = status || 'approved';
                }
                catch (err) {
                    (_q = (_p = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _p === void 0 ? void 0 : _p.warn) === null || _q === void 0 ? void 0 : _q.call(_p, `[payments.confirm] No pude obtener preference ${preferenceIdQ}: ${err === null || err === void 0 ? void 0 : err.message}`);
                }
            }
            if (!orderRef) {
                ctx.status = 400;
                ctx.body = { ok: false, error: 'No se pudo determinar orderId (external_reference/orderRef)' };
                return;
            }
            // 3) Resolver PK del pedido con múltiples estrategias
            const orderPk = await resolveOrderPk(orderRef);
            if (!orderPk) {
                ctx.status = 404;
                ctx.body = { ok: false, error: `Pedido no encontrado para ref: ${orderRef}` };
                return;
            }
            // 4) Marcar como paid si corresponde
            const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
            const shouldMarkPaid = normalizedStatus === 'approved';
            if (shouldMarkPaid)
                await markOrderPaid(orderPk);
            else
                (_s = (_r = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _r === void 0 ? void 0 : _r.info) === null || _s === void 0 ? void 0 : _s.call(_r, `[payments.confirm] Estado no aprobado (${normalizedStatus}). No marco paid.`);
            // 5) Actualizar registro de payments si existe
            const paymentUID = resolvePaymentUID();
            if (paymentUID) {
                try {
                    const searchFilters = { order: orderPk };
                    if (preferenceIdQ)
                        searchFilters.mp_preference_id = String(preferenceIdQ);
                    const existing = await strapi.entityService.findMany(paymentUID, { filters: searchFilters, limit: 1 });
                    if (existing && existing.length > 0) {
                        const data = {};
                        if (normalizedStatus)
                            data.status = normalizedStatus;
                        if (paymentIdQ)
                            data.mp_payment_id = String(paymentIdQ);
                        if (shouldMarkPaid)
                            data.paid_at = new Date();
                        if (rawPayment)
                            data.raw_payment = rawPayment;
                        if (Object.keys(data).length > 0)
                            await strapi.entityService.update(paymentUID, existing[0].id, { data });
                    }
                }
                catch (err) {
                    (_u = (_t = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _t === void 0 ? void 0 : _t.debug) === null || _u === void 0 ? void 0 : _u.call(_t, `[payments.confirm] No se pudo actualizar registro de pago: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                }
            }
            // 6) Redirección al front si vino "redirect"
            const redirect = ((_v = ctx.request.query) === null || _v === void 0 ? void 0 : _v.redirect) || null;
            if (redirect) {
                const dest = (0, urls_1.ensureHttpUrl)(redirect);
                ctx.status = 302;
                ctx.redirect(dest);
                return;
            }
            ctx.body = { ok: true, orderId: orderPk, status: normalizedStatus || status || 'approved' };
        }
        catch (e) {
            (_x = (_w = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _w === void 0 ? void 0 : _w.error) === null || _x === void 0 ? void 0 : _x.call(_w, '[payments.confirm] ', ((_y = e === null || e === void 0 ? void 0 : e.response) === null || _y === void 0 ? void 0 : _y.data) || (e === null || e === void 0 ? void 0 : e.message));
            ctx.status = 500;
            ctx.body = { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || 'Error confirmando pago' };
        }
    },
    /**
     * POST /restaurants/:slug/payments
     * Mock/Manual payment creation
     */
    async create(ctx) {
        var _a;
        const restauranteId = ctx.state.restauranteId;
        const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
        const { orderId, status, amount, provider, externalRef } = payload;
        if (!orderId)
            return ctx.badRequest('Falta orderId');
        // 1) Verificar que el pedido exista y pertenezca al restaurante
        const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
            fields: ['id', 'order_status', 'total'],
            populate: { restaurante: { fields: ['id'] } },
        });
        if (!(order === null || order === void 0 ? void 0 : order.id))
            return ctx.notFound('Pedido no encontrado');
        const orderRestId = ((_a = order.restaurante) === null || _a === void 0 ? void 0 : _a.id) || order.restaurante;
        if (String(orderRestId) !== String(restauranteId)) {
            return ctx.unauthorized('Pedido de otro restaurante');
        }
        // 2) Recalcular subtotal en servidor
        let serverSubtotal = 0;
        try {
            const itemsA = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
                filters: { pedido: order.id },
                fields: ['qty', 'price'],
                limit: 500,
            });
            if (Array.isArray(itemsA) && itemsA.length) {
                serverSubtotal = itemsA.reduce((s, it) => {
                    const q = Number((it === null || it === void 0 ? void 0 : it.qty) || 0);
                    const p = Number((it === null || it === void 0 ? void 0 : it.price) || 0);
                    const line = q * p;
                    return s + (Number.isFinite(line) ? line : 0);
                }, 0);
            }
        }
        catch (e) {
            strapi.log.debug('No se pudo leer item-pedido, se usa order.total como fallback');
        }
        if (!Number.isFinite(serverSubtotal) || serverSubtotal <= 0) {
            serverSubtotal = Number(order.total || 0) || 0;
        }
        // 3) Validar amount
        if (amount !== undefined && amount !== null) {
            const cents = (n) => Math.round(Number(n) * 100);
            if (cents(amount) !== cents(serverSubtotal)) {
                return ctx.badRequest('El monto no coincide con el subtotal del servidor');
            }
        }
        // 4) Datos a guardar
        const data = {
            status: status || 'approved',
            amount: amount !== null && amount !== void 0 ? amount : serverSubtotal,
            provider: provider || 'mock',
            externalRef: externalRef || null,
            order: order.id,
            restaurante: restauranteId,
        };
        // 5) Crear Payment
        try {
            await strapi.entityService.create('api::payments.payments', { data });
        }
        catch (e1) {
            try {
                await strapi.entityService.create('api::payment.payment', { data });
            }
            catch (e2) {
                strapi.log.warn('Payment CT missing. Continuing without persisting payment record.');
            }
        }
        // 6) Si aprobado, marcar pedido como paid
        if (String(status || 'approved').toLowerCase() === 'approved') {
            await strapi.entityService.update('api::pedido.pedido', order.id, {
                data: { order_status: 'paid' },
            });
        }
        ctx.body = { data: { ok: true } };
    },
};
