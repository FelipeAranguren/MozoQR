declare const strapi: any;

export default {
  async stockOverview(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;

    const productos = await strapi.entityService.findMany('api::producto.producto', {
      filters: { restaurante: { id: restauranteId }, stock_enabled: true },
      fields: ['id', 'name', 'sku', 'price', 'available', 'stock_quantity', 'stock_unit', 'stock_min_alert', 'stock_enabled'],
      // Strapi 5: mezclar `fields` en populate + `image: true` puede fallar; el array es el patrón usado en producto.controller
      populate: ['categoria', 'image'],
      sort: { name: 'asc' },
      limit: 10000,
    });

    const data = productos.map((p: any) => ({
      ...p,
      stock_status:
        Number(p.stock_quantity) <= 0
          ? 'sin_stock'
          : Number(p.stock_quantity) <= Number(p.stock_min_alert)
          ? 'bajo'
          : 'ok',
    }));

    ctx.body = { data };
  },

  async ajusteStock(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const productoId = ctx.params.productoId;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { new_quantity, notes } = body;

    if (new_quantity == null || Number(new_quantity) < 0) {
      return ctx.badRequest('new_quantity es requerido y debe ser >= 0');
    }

    const producto = await strapi.entityService.findOne('api::producto.producto', productoId, {
      fields: ['id', 'name', 'stock_quantity', 'stock_enabled'],
      populate: { restaurante: { fields: ['id'] } },
    });

    if (!producto?.id) return ctx.notFound('Producto no encontrado');
    if (String(producto.restaurante?.id || producto.restaurante) !== String(restauranteId)) {
      return ctx.forbidden('Producto de otro restaurante');
    }

    const previousStock = Number(producto.stock_quantity) || 0;
    const newStock = Number(new_quantity);
    const diff = newStock - previousStock;

    await strapi.entityService.update('api::producto.producto', productoId, {
      data: { stock_quantity: newStock, stock_enabled: true },
    });

    await strapi.entityService.create('api::movimiento-stock.movimiento-stock', {
      data: {
        type: 'ajuste_manual',
        quantity: diff,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_type: 'manual',
        notes: notes || `Ajuste manual: ${previousStock} -> ${newStock}`,
        timestamp: new Date().toISOString(),
        producto: productoId,
        restaurante: restauranteId,
        created_by_user: user?.id || null,
      },
    });

    ctx.body = { data: { id: productoId, previous_stock: previousStock, new_stock: newStock, diff } };
  },

  async alertas(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;

    const productos = await strapi.entityService.findMany('api::producto.producto', {
      filters: { restaurante: { id: restauranteId }, stock_enabled: true },
      fields: ['id', 'name', 'sku', 'stock_quantity', 'stock_unit', 'stock_min_alert', 'available'],
      populate: ['categoria'],
      limit: 10000,
    });

    const alertas = productos.filter((p: any) => {
      const qty = Number(p.stock_quantity) || 0;
      const min = Number(p.stock_min_alert) || 0;
      return qty <= min;
    }).map((p: any) => ({
      ...p,
      stock_status: Number(p.stock_quantity) <= 0 ? 'sin_stock' : 'bajo',
    }));

    ctx.body = { data: alertas };
  },

  async movimientosStock(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const { productoId, type, desde, hasta, page = 1, pageSize = 50 } = ctx.request.query || {};

    const filters: any = { restaurante: { id: restauranteId } };
    if (productoId) filters.producto = productoId;
    if (type) filters.type = type;
    if (desde || hasta) {
      filters.timestamp = {};
      if (desde) filters.timestamp.$gte = desde;
      if (hasta) filters.timestamp.$lte = hasta;
    }

    const movimientos = await strapi.entityService.findMany('api::movimiento-stock.movimiento-stock', {
      filters,
      sort: { timestamp: 'desc' },
      populate: {
        producto: { fields: ['id', 'name', 'sku'] },
        created_by_user: { fields: ['id', 'username', 'fullname'] },
      },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: movimientos };
  },

  // --- Compras ---

  async crearCompra(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { date, supplier, notes, items } = body;

    if (!date) return ctx.badRequest('date es requerido');
    if (!Array.isArray(items) || items.length === 0) {
      return ctx.badRequest('items es requerido y no puede estar vacío');
    }

    let total = 0;
    for (const it of items) {
      if (!it.productoId || !it.quantity || !it.unit_cost) {
        return ctx.badRequest('Cada item necesita productoId, quantity y unit_cost');
      }
      total += Number(it.quantity) * Number(it.unit_cost);
    }

    const compra = await strapi.entityService.create('api::compra.compra', {
      data: {
        date,
        supplier: supplier || null,
        total,
        status: 'pendiente',
        notes: notes || null,
        restaurante: restauranteId,
        created_by_user: user?.id || null,
      },
    });

    for (const it of items) {
      const qty = Number(it.quantity);
      const unitCost = Number(it.unit_cost);
      await strapi.entityService.create('api::item-compra.item-compra', {
        data: {
          quantity: qty,
          unit_cost: unitCost,
          total_cost: qty * unitCost,
          compra: compra.id,
          producto: it.productoId,
        },
      });
    }

    const full = await strapi.entityService.findOne('api::compra.compra', compra.id, {
      populate: { items: { populate: { producto: { fields: ['id', 'name', 'sku'] } } } },
    });

    ctx.body = { data: full };
  },

  async listarCompras(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const { status, desde, hasta, page = 1, pageSize = 20 } = ctx.request.query || {};

    const filters: any = { restaurante: { id: restauranteId } };
    if (status) filters.status = status;
    if (desde || hasta) {
      filters.date = {};
      if (desde) filters.date.$gte = desde;
      if (hasta) filters.date.$lte = hasta;
    }

    const compras = await strapi.entityService.findMany('api::compra.compra', {
      filters,
      // Strapi 5: varios campos de orden → array (objeto con 2+ claves no es válido)
      sort: [{ date: 'desc' }, { createdAt: 'desc' }],
      populate: {
        items: { populate: { producto: { fields: ['id', 'name'] } } },
        created_by_user: { fields: ['id', 'username', 'fullname'] },
      },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: compras };
  },

  async detalleCompra(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const compraId = ctx.params.id;

    const compra = await strapi.entityService.findOne('api::compra.compra', compraId, {
      populate: {
        items: { populate: { producto: { fields: ['id', 'name', 'sku', 'stock_quantity', 'stock_unit'] } } },
        created_by_user: { fields: ['id', 'username', 'fullname'] },
        restaurante: { fields: ['id'] },
      },
    });

    if (!compra?.id) return ctx.notFound('Compra no encontrada');
    if (String(compra.restaurante?.id || compra.restaurante) !== String(restauranteId)) {
      return ctx.forbidden('Compra de otro restaurante');
    }

    ctx.body = { data: compra };
  },

  async recibirCompra(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const compraId = ctx.params.id;

    const compra = await strapi.entityService.findOne('api::compra.compra', compraId, {
      populate: {
        items: { populate: { producto: { fields: ['id', 'stock_quantity', 'stock_enabled'] } } },
        restaurante: { fields: ['id'] },
      },
    });

    if (!compra?.id) return ctx.notFound('Compra no encontrada');
    if (String(compra.restaurante?.id || compra.restaurante) !== String(restauranteId)) {
      return ctx.forbidden('Compra de otro restaurante');
    }
    if (compra.status !== 'pendiente') {
      return ctx.badRequest(`No se puede recibir una compra con estado "${compra.status}"`);
    }

    const now = new Date().toISOString();

    for (const item of compra.items || []) {
      const prod = item.producto;
      if (!prod?.id) continue;

      const previousStock = Number(prod.stock_quantity) || 0;
      const addQty = Number(item.quantity) || 0;
      const newStock = previousStock + addQty;

      await strapi.entityService.update('api::producto.producto', prod.id, {
        data: { stock_quantity: newStock, stock_enabled: true },
      });

      await strapi.entityService.create('api::movimiento-stock.movimiento-stock', {
        data: {
          type: 'compra',
          quantity: addQty,
          previous_stock: previousStock,
          new_stock: newStock,
          reference_type: 'compra',
          reference_id: compra.id,
          notes: `Compra #${compra.id} recibida`,
          timestamp: now,
          producto: prod.id,
          restaurante: restauranteId,
          created_by_user: user?.id || null,
        },
      });
    }

    const updated = await strapi.entityService.update('api::compra.compra', compraId, {
      data: { status: 'recibida' },
    });

    ctx.body = { data: updated };
  },

  async cancelarCompra(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const compraId = ctx.params.id;

    const compra = await strapi.entityService.findOne('api::compra.compra', compraId, {
      populate: { restaurante: { fields: ['id'] } },
    });

    if (!compra?.id) return ctx.notFound('Compra no encontrada');
    if (String(compra.restaurante?.id || compra.restaurante) !== String(restauranteId)) {
      return ctx.forbidden('Compra de otro restaurante');
    }
    if (compra.status !== 'pendiente') {
      return ctx.badRequest(`No se puede cancelar una compra con estado "${compra.status}"`);
    }

    const updated = await strapi.entityService.update('api::compra.compra', compraId, {
      data: { status: 'cancelada' },
    });

    ctx.body = { data: updated };
  },
};
