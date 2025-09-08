"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/api/tenant/controllers/tenant.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const utils_1 = require("@strapi/utils");
const { ValidationError, NotFoundError, ForbiddenError } = utils_1.errors;
// --- helper: obtener restaurante + plan ---
async function getRestaurant(idOrSlug) {
    const q = idOrSlug.id
        ? { filters: { id: idOrSlug.id }, fields: ['id', 'name', 'slug', 'plan'], limit: 1 }
        : { filters: { slug: idOrSlug.slug }, fields: ['id', 'name', 'slug', 'plan'], limit: 1 };
    const rows = await strapi.entityService.findMany('api::restaurante.restaurante', q);
    const r = rows === null || rows === void 0 ? void 0 : rows[0];
    if (!(r === null || r === void 0 ? void 0 : r.id))
        throw new NotFoundError('Restaurante no encontrado');
    return r;
}
// --- GET /restaurants/:slug/menus ---
async function menus(ctx) {
    const restaurantId = ctx.state.restaurantId;
    const r = await getRestaurant({ id: restaurantId });
    const plan = r.plan || 'BASIC';
    const cats = await strapi.entityService.findMany('api::categoria.categoria', {
        filters: { restaurante: { id: restaurantId } },
        fields: ['id', 'name', 'order'],
        sort: ['order:asc', 'name:asc'],
        populate: {
            productos: {
                filters: { isAvailable: true },
                fields: ['id', 'name', 'price'],
                populate: plan === 'PRO' ? { image: { fields: ['url', 'formats'] } } : {},
            },
        },
    });
    // Gate de imagen si plan !== PRO
    const categories = (cats || []).map(c => ({
        id: c.id, name: c.name,
        products: (c.productos || []).map(p => ({
            id: p.id, name: p.name, price: p.price,
            image: plan === 'PRO' ? (p.image || null) : null,
        })),
    }));
    ctx.body = { data: { name: r.name, categories } };
}
// --- POST /restaurants/:slug/orders --- (CALCULO EN SERVER + VALIDACIONES + IDEMPOTENCIA)
async function createOrder(ctx) {
    var _a, _b;
    const restaurantId = ctx.state.restaurantId;
    const { table, tableSessionId, items, notes, clientRequestId } = ctx.request.body || {};
    if (!Number.isFinite(Number(table)))
        throw new ValidationError('Mesa inválida');
    if (!Array.isArray(items) || items.length === 0)
        throw new ValidationError('Items requeridos');
    // Validar productos y calcular subtotal del lado servidor
    const productIds = items.map(it => Number(it.id || it.productId)).filter(Boolean);
    const prods = await strapi.entityService.findMany('api::producto.producto', {
        filters: { id: { $in: productIds }, restaurante: { id: restaurantId }, isAvailable: true },
        fields: ['id', 'price'],
        limit: 1000,
    });
    const byId = new Map(prods.map((p) => [Number(p.id), { id: Number(p.id), price: Number(p.price) }]));
    let subtotal = 0;
    const saneItems = items.map(it => {
        const pid = Number(it.id || it.productId);
        const qty = Number(it.qty || it.quantity || 0);
        if (!pid || !qty || qty <= 0)
            throw new ValidationError('qty>0 requerido');
        const p = byId.get(pid);
        if (!p)
            throw new ValidationError(`Producto ${pid} no disponible`);
        const line = qty * Number(p.price || 0);
        subtotal += line;
        return { product: pid, quantity: qty, unitPrice: Number(p.price || 0) };
    });
    // idempotencia simple: si llega clientRequestId, buscar Payment/Order con ese token
    if (clientRequestId) {
        const existing = await strapi.db.query('api::pedido.pedido').findOne({
            where: { clientRequestId, restaurante: restaurantId },
            select: ['id', 'documentId'],
        });
        if (existing === null || existing === void 0 ? void 0 : existing.id) {
            ctx.body = { data: { id: existing.documentId || existing.id }, meta: { idempotent: true } };
            return;
        }
    }
    // Mesa + Sesión abierta (o crear)
    const mesa = (_a = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: { restaurante: { id: restaurantId }, number: Number(table) },
        fields: ['id', 'number'],
        limit: 1,
    }).then(rows => rows === null || rows === void 0 ? void 0 : rows[0])) !== null && _a !== void 0 ? _a : await strapi.entityService.create('api::mesa.mesa', {
        data: { number: Number(table), restaurante: restaurantId, publishedAt: new Date() },
    });
    const open = (_b = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
        filters: { restaurante: { id: restaurantId }, mesa: { id: mesa.id }, session_status: 'open' },
        fields: ['id', 'code'],
        limit: 1,
    }).then(rows => rows === null || rows === void 0 ? void 0 : rows[0])) !== null && _b !== void 0 ? _b : await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
        data: { code: tableSessionId || `sess-${Date.now()}`, session_status: 'open', restaurante: restaurantId, mesa: mesa.id, publishedAt: new Date() },
    });
    const pedido = await strapi.entityService.create('api::pedido.pedido', {
        data: {
            order_status: 'pending', // NEW
            customerNotes: notes || '',
            total: subtotal,
            restaurante: restaurantId,
            mesa_sesion: open.id,
            clientRequestId: clientRequestId || null,
            items: saneItems, // si usás componente repeatable o relation intermedia, adaptar
            publishedAt: new Date(),
        },
    });
    ctx.body = { data: { id: pedido.documentId || pedido.id, total: subtotal } };
}
// --- GET /restaurants/:slug/orders?status&table&since ---
async function listOrders(ctx) {
    const restaurantId = ctx.state.restaurantId;
    const q = ctx.request.query || {};
    const filters = { restaurante: { id: restaurantId } };
    if (q.status) {
        const arr = Array.isArray(q.status) ? q.status : String(q.status).split(',');
        filters.order_status = { $in: arr };
    }
    if (q.table) {
        filters.mesa_sesion = {
            mesa: { number: Number(q.table) },
        };
    }
    if (q.since) {
        const sinceDate = new Date(isNaN(Number(q.since)) ? String(q.since) : Number(q.since));
        filters.updatedAt = { $gt: sinceDate.toISOString() };
    }
    const rows = await strapi.entityService.findMany('api::pedido.pedido', {
        filters,
        sort: ['createdAt:desc'],
        fields: ['id', 'order_status', 'total', 'createdAt', 'updatedAt', 'documentId'],
        populate: {
            mesa_sesion: { fields: ['id', 'code'], populate: { mesa: { fields: ['number'] } } },
        },
        limit: 200,
    });
    ctx.body = { data: rows };
}
// --- PATCH /restaurants/:slug/orders/:id/status ---
const LEGAL = {
    pending: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['paid', 'cancelled'],
    paid: [],
    cancelled: [],
};
async function updateOrderStatus(ctx) {
    var _a, _b;
    const restaurantId = ctx.state.restaurantId;
    const idParam = (_a = ctx.params) === null || _a === void 0 ? void 0 : _a.id;
    const { status } = ctx.request.body || {};
    if (!status)
        throw new ValidationError('status requerido');
    // Resolver id real por id o documentId
    const idNum = Number(idParam);
    const pedido = Number.isFinite(idNum)
        ? await strapi.entityService.findOne('api::pedido.pedido', idNum, { fields: ['id', 'order_status', 'restaurante'] })
        : await strapi.db.query('api::pedido.pedido').findOne({ where: { documentId: idParam }, select: ['id', 'order_status', 'restaurante'] });
    if (!(pedido === null || pedido === void 0 ? void 0 : pedido.id))
        throw new NotFoundError('Pedido no encontrado');
    if (Number(((_b = pedido.restaurante) === null || _b === void 0 ? void 0 : _b.id) || pedido.restaurante) !== Number(restaurantId)) {
        throw new ForbiddenError('Pedido de otro restaurante');
    }
    const from = String(pedido.order_status);
    const allowed = LEGAL[from] || [];
    if (!allowed.includes(String(status))) {
        throw new ValidationError(`Transición inválida ${from} → ${status}`);
    }
    const updated = await strapi.entityService.update('api::pedido.pedido', pedido.id, {
        data: { order_status: status },
    });
    ctx.body = { data: { id: updated.documentId || updated.id, order_status: status } };
}
// --- POST /restaurants/:slug/payments (mock) ---
async function createPaymentMock(ctx) {
    var _a;
    const restaurantId = ctx.state.restaurantId;
    const { orderId, status } = ctx.request.body || {};
    if (!orderId)
        throw new ValidationError('orderId requerido');
    // Resolver id real por id/documentId
    const idNum = Number(orderId);
    const pedido = Number.isFinite(idNum)
        ? await strapi.entityService.findOne('api::pedido.pedido', idNum, { fields: ['id', 'order_status', 'restaurante'] })
        : await strapi.db.query('api::pedido.pedido').findOne({ where: { documentId: orderId }, select: ['id', 'order_status', 'restaurante'] });
    if (!(pedido === null || pedido === void 0 ? void 0 : pedido.id))
        throw new NotFoundError('Pedido no encontrado');
    if (Number(((_a = pedido.restaurante) === null || _a === void 0 ? void 0 : _a.id) || pedido.restaurante) !== Number(restaurantId)) {
        throw new ForbiddenError('Pedido de otro restaurante');
    }
    const pay = await strapi.entityService.create('api::payments.payment', {
        data: { restaurante: restaurantId, pedido: pedido.id, status: status || 'APPROVED', publishedAt: new Date() },
    });
    if ((status || 'APPROVED') === 'APPROVED') {
        await strapi.entityService.update('api::pedido.pedido', pedido.id, { data: { order_status: 'paid' } });
    }
    ctx.body = { data: { paymentId: pay.id, status: status || 'APPROVED' } };
}
exports.default = { menus, createOrder, listOrders, updateOrderStatus, createPaymentMock };
