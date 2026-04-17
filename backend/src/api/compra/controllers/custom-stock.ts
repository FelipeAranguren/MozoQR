declare const strapi: any;

/** Resuelve id numérico de producto (Strapi 5 puede mandar documentId en el payload). */
async function resolveProductoPk(
  strapi: any,
  raw: unknown,
  restauranteId: number
): Promise<number | null> {
  if (raw === null || raw === undefined || raw === '') return null;
  const str = String(raw).trim();
  if (!str) return null;

  if (/^\d+$/.test(str)) {
    const row = await strapi.db.query('api::producto.producto').findOne({
      where: { id: Number(str), restaurante: { id: restauranteId } },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  const byDoc = await strapi.db.query('api::producto.producto').findOne({
    where: { documentId: str, restaurante: { id: restauranteId } },
    select: ['id'],
  });
  return byDoc?.id ?? null;
}

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
    const restauranteId = Number(ctx.state.restauranteId);
    const user = ctx.state.user;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { date, supplier, notes, items } = body;

    if (!date) return ctx.badRequest('date es requerido');
    if (!Array.isArray(items) || items.length === 0) {
      return ctx.badRequest('items es requerido y no puede estar vacío');
    }
    if (!Number.isFinite(restauranteId) || restauranteId <= 0) {
      return ctx.badRequest('restaurante inválido');
    }

    try {
      type ResolvedLine = { productoPk: number; qty: number; unitCost: number };
      const resolved: ResolvedLine[] = [];
      let total = 0;
      let line = 0;

      for (const it of items) {
        line += 1;
        if (it.productoId == null || it.quantity == null || it.unit_cost == null) {
          return ctx.badRequest('Cada item necesita productoId, quantity y unit_cost');
        }
        const productoPk = await resolveProductoPk(strapi, it.productoId, restauranteId);
        if (!productoPk) {
          return ctx.badRequest(
            `Producto inválido o no pertenece a este restaurante (línea ${line}). Verificá el producto seleccionado.`
          );
        }
        const qty = Number(it.quantity);
        const unitCost = Number(it.unit_cost);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return ctx.badRequest(`Cantidad o costo unitario inválidos (línea ${line})`);
        }
        total += qty * unitCost;
        resolved.push({ productoPk, qty, unitCost });
      }

      const compraPayload: Record<string, unknown> = {
        date,
        supplier: supplier ? String(supplier).trim() : null,
        total: Number(total.toFixed(2)),
        status: 'pendiente',
        notes: notes ? String(notes).trim() : null,
        restaurante: restauranteId,
      };
      if (user?.id != null && user.id !== '') {
        const uid = Number(user.id);
        if (Number.isFinite(uid) && uid > 0) {
          const urow = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: uid },
            select: ['id'],
          });
          if (urow?.id) {
            compraPayload.created_by_user = urow.id;
          }
        }
      }

      let compra: any;
      try {
        compra = await strapi.entityService.create('api::compra.compra', {
          data: compraPayload,
        });
      } catch (ce: any) {
        strapi.log.error('[crearCompra] falló create compra', ce);
        const m = ce?.message || String(ce);
        if (ce?.name === 'ValidationError' || ce?.details?.errors?.length) {
          return ctx.badRequest(m);
        }
        ctx.status = 500;
        ctx.body = { error: { message: m } };
        return;
      }

      let compraPk: number | null = compra?.id != null ? Number(compra.id) : null;
      if (compraPk == null && compra?.documentId) {
        const crow = await strapi.db.query('api::compra.compra').findOne({
          where: { documentId: compra.documentId },
          select: ['id'],
        });
        compraPk = crow?.id != null ? Number(crow.id) : null;
      }
      if (compraPk == null || !Number.isFinite(compraPk)) {
        strapi.log.error('[crearCompra] compra sin id tras create', compra);
        return ctx.internalServerError('No se pudo crear la compra (sin id)');
      }

      for (let i = 0; i < resolved.length; i += 1) {
        const row = resolved[i];
        const lineTotal = Number((row.qty * row.unitCost).toFixed(2));
        try {
          await strapi.entityService.create('api::item-compra.item-compra', {
            data: {
              quantity: row.qty,
              unit_cost: row.unitCost,
              total_cost: lineTotal,
              compra: compraPk,
              producto: row.productoPk,
            },
          });
        } catch (ie: any) {
          strapi.log.error(`[crearCompra] falló item-compra línea ${i + 1}`, ie);
          const m = ie?.message || String(ie);
          if (ie?.name === 'ValidationError' || ie?.details?.errors?.length) {
            return ctx.badRequest(m);
          }
          ctx.status = 500;
          ctx.body = { error: { message: `Ítem ${i + 1}: ${m}` } };
          return;
        }
      }

      // Leer compra + ítems sin entityService.populate (suele romper en Strapi 5).
      let full: unknown = null;
      try {
        full = await strapi.db.query('api::compra.compra').findOne({
          where: { id: compraPk },
          populate: { items: { populate: { producto: true } } },
        });
      } catch (fe: any) {
        strapi.log.warn('[crearCompra] findOne con items+producto falló', fe?.message);
        try {
          full = await strapi.db.query('api::compra.compra').findOne({
            where: { id: compraPk },
            populate: { items: true },
          });
        } catch (fe2: any) {
          strapi.log.warn('[crearCompra] findOne solo items falló', fe2?.message);
          full = { id: compraPk, documentId: compra?.documentId };
        }
      }

      ctx.body = { data: full };
    } catch (e: any) {
      strapi.log.error('[crearCompra] inesperado', e);
      const msg = e?.message || String(e);
      ctx.status = 500;
      ctx.body = { error: { message: msg } };
    }
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
      populate: ['items', 'items.producto', 'restaurante'],
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

      const addQty = Number(item.quantity) || 0;
      if (addQty <= 0) continue;

      const stockRow = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { producto: prod.id },
        select: ['id', 'stock_actual'],
      });

      if (stockRow?.id) {
        const prevSi = Number(stockRow.stock_actual) || 0;
        const newSi = prevSi + addQty;
        const unitCost = Number(item.unit_cost);

        await strapi.entityService.update('api::stock-item.stock-item', stockRow.id, {
          data: {
            stock_actual: newSi,
            ...(Number.isFinite(unitCost) && unitCost > 0 ? { precio_costo: unitCost } : {}),
          },
        });

        const movData: Record<string, unknown> = {
          tipo: 'entrada',
          cantidad: addQty,
          motivo: `Compra #${compra.id} recibida`,
          stock_item: stockRow.id,
          publishedAt: now,
        };

        await strapi.entityService.create('api::stock-movement.stock-movement', {
          data: movData,
        });
      } else {
        const previousStock = Number(prod.stock_quantity) || 0;
        const newStock = previousStock + addQty;

        await strapi.entityService.update('api::producto.producto', prod.id, {
          data: { stock_quantity: newStock, stock_enabled: true },
        });

        const movimientoPayload: Record<string, unknown> = {
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
        };
        if (user?.id != null && user.id !== '') {
          movimientoPayload.created_by_user = user.id;
        }

        await strapi.entityService.create('api::movimiento-stock.movimiento-stock', {
          data: movimientoPayload,
        });
      }
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
