// backend/src/api/pedido/controllers/scoped-orders.js
'use strict';

const ALLOWED_NEXT = {
  pending: ['preparing', 'served', 'paid'],
  preparing: ['served', 'paid'],
  served: ['paid'],
  paid: [],
};

async function getMesaByNumber(strapi, restauranteId, number) {
  const [mesa] = await strapi.entityService.findMany('api::mesa.mesa', {
    filters: { restaurante: restauranteId, number: Number(number) },
    fields: ['id', 'number'],
    limit: 1,
  });
  return mesa;
}

async function getOrCreateMesaSesion(strapi, restauranteId, mesaId, tableSessionId) {
  // Try by code (uid) + open
  const [ses] = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
    filters: {
      restaurante: restauranteId,
      mesa: mesaId,
      code: tableSessionId || undefined,
      session_status: 'open',
    },
    fields: ['id', 'code', 'session_status'],
    limit: 1,
  });
  if (ses?.id) return ses;

  // Create one if not found
  const nowIso = new Date().toISOString();
  const created = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
    data: {
      code: tableSessionId || `sess_${Date.now()}`,
      openedAt: nowIso,
      session_status: 'open',
      mesa: mesaId,
      restaurante: restauranteId,
      total: 0,
      paidTotal: 0,
    },
  });
  return created;
}

module.exports = {
  /**
   * GET /restaurants/:slug/orders?status=&table=&since=ISO
   * Staff/Owner only. Returns orders scoped by restaurant.
   */
  async find(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const { status, table, since } = ctx.request.query || {};

    const filters = { restaurante: restauranteId };
    if (status) filters.order_status = status;
    if (table) filters['mesa_sesion']['mesa']['number'] = Number(table);
    if (since) filters.createdAt = { $gt: since };

    const rows = await strapi.entityService.findMany('api::pedido.pedido', {
      filters,
      sort: { createdAt: 'desc' },
      populate: {
        mesa_sesion: { populate: { mesa: { fields: ['number', 'displayName'] } } },
        items: { populate: { product: { fields: ['name', 'sku'], populate: { image: true } } } },
      },
      fields: ['id', 'order_status', 'total', 'customerNotes', 'createdAt', 'updatedAt'],
      publicationState: 'live',
      limit: 200,
    });

    ctx.body = { data: rows };
  },

  /**
   * POST /restaurants/:slug/orders
   * body: { table, tableSessionId, items: [{ productId, quantity, notes }], notes }
   * Public endpoint.
   */
  async create(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const { table, tableSessionId, items, notes, clientRequestId } = payload;

    if (!table) return ctx.badRequest('Falta número de mesa');
    if (!Array.isArray(items) || items.length === 0) {
      return ctx.badRequest('Items vacíos');
    }

    // Mesa + sesión
    const mesa = await getMesaByNumber(strapi, restauranteId, table);
    if (!mesa?.id) return ctx.badRequest('Mesa inválida');
    const sesion = await getOrCreateMesaSesion(strapi, restauranteId, mesa.id, tableSessionId);

    // Validar productos y calcular subtotal con precios actuales
    let subtotal = 0;
    const normalized = [];
    for (const it of items) {
      const pid = it.productId || it.product || it.id;
      const qty = Number(it.quantity || it.qty || 0);
      const note = it.notes || null;
      if (!pid || qty <= 0) return ctx.badRequest('Producto o cantidad inválida');

      const prod = await strapi.entityService.findOne('api::producto.producto', pid, {
        fields: ['id', 'name', 'price', 'available'],
        populate: { categoria: { fields: ['id'] }, restaurante: { fields: ['id'] } },
      });
      if (!prod?.id) return ctx.badRequest(`Producto ${pid} inexistente`);
      if (String(prod.restaurante?.id || prod.restaurante) !== String(restauranteId)) {
        return ctx.badRequest('Producto no pertenece a este restaurante');
      }
      if (!prod.available) return ctx.badRequest(`Producto no disponible: ${prod.name}`);

      const unit = Number(prod.price || 0);
      const total = unit * qty;
      subtotal += total;
      normalized.push({ product: pid, quantity: qty, UnitPrice: unit, totalPrice: total, notes: note });
    }

    // Idempotencia best-effort (últimos 90s, misma sesión y total)
    const ninetyAgo = new Date(Date.now() - 90_000).toISOString();
    const existing = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: {
        restaurante: restauranteId,
        mesa_sesion: sesion.id,
        total: subtotal,
        createdAt: { $gt: ninetyAgo },
        order_status: 'pending',
      },
      fields: ['id'],
      limit: 1,
    });
    if (existing?.[0]?.id) {
      // Return existing to avoid duplicates
      const dup = await strapi.entityService.findOne('api::pedido.pedido', existing[0].id, {
        populate: { items: true, mesa_sesion: true },
      });
      ctx.status = 200;
      ctx.body = { data: dup, meta: { deduped: true } };
      return;
    }

    // Crear pedido + items
    const created = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        order_status: 'pending',
        total: subtotal,
        customerNotes: notes || null,
        mesa_sesion: sesion.id,
        restaurante: restauranteId,
      },
    });

    for (const row of normalized) {
      await strapi.entityService.create('api::item-pedido.item-pedido', {
        data: { ...row, order: created.id },
      });
    }

    const full = await strapi.entityService.findOne('api::pedido.pedido', created.id, {
      populate: {
        items: { populate: { product: { fields: ['name', 'sku'] } } },
        mesa_sesion: { populate: { mesa: { fields: ['number'] } } },
      },
    });

    ctx.body = { data: full };
  },

  /**
   * PATCH /restaurants/:slug/orders/:id/status
   * body: { status }
   */
  async updateStatus(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const id = ctx.params.id;
    const { status } = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    if (!status) return ctx.badRequest('Falta status');

    const order = await strapi.entityService.findOne('api::pedido.pedido', id, {
      fields: ['id', 'order_status'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.id) return ctx.notFound('Pedido no encontrado');
    if (String(order.restaurante?.id || order.restaurante) !== String(restauranteId)) {
      return ctx.unauthorized('Pedido de otro restaurante');
    }

    const current = order.order_status;
    const allowed = ALLOWED_NEXT[current] || [];
    if (!allowed.includes(status)) {
      return ctx.badRequest(`Transición inválida: ${current} → ${status}`);
    }

    const updated = await strapi.entityService.update('api::pedido.pedido', id, {
      data: { order_status: status },
    });

    ctx.body = { data: updated };
  },
};
