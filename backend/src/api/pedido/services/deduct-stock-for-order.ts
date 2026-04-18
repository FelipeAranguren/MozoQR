/**
 * Descuenta inventario al cobrar un pedido: `producto.stock_quantity` + movimiento-stock legacy,
 * y si existe `stock-item` vinculado, crea `stock-movement` tipo salida (sincroniza `stock_actual`).
 *
 * Se invoca desde el lifecycle `afterUpdate` del pedido cuando pasa a `order_status: 'paid'`
 * (incluye pagos MP confirm, webhook, caja manual, etc.). No debe lanzar: usar `safeDeductStockForPaidOrder`.
 */

export async function safeDeductStockForPaidOrder(strapi: any, orderId: number, restauranteId: number) {
  try {
    await deductStockForOrder(strapi, orderId, restauranteId);
  } catch (err: any) {
    strapi?.log?.error?.(
      `[deductStockForOrder] Fallo no controlado (pedido ${orderId}):`,
      err?.message ?? err,
    );
  }
}

export async function deductStockForOrder(strapi: any, orderId: number, restauranteId: number) {
  const existing = await strapi.entityService.findMany('api::movimiento-stock.movimiento-stock', {
    filters: { reference_type: 'pedido', reference_id: orderId },
    fields: ['id'],
    limit: 1,
  });
  if (Array.isArray(existing) && existing.length > 0) {
    return;
  }

  const items = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
    filters: { order: orderId },
    fields: ['id', 'quantity'],
    populate: {
      product: {
        fields: ['id', 'stock_enabled', 'stock_quantity', 'stock_min_alert', 'available', 'name'],
        populate: { stock_item: { fields: ['id'] } },
      },
    },
    limit: 200,
  });

  const nowIso = new Date().toISOString();

  for (const item of items) {
    const prodPop = item.product as
      | {
          id?: number;
          stock_enabled?: boolean;
          stock_quantity?: unknown;
          stock_min_alert?: unknown;
          available?: boolean;
          name?: string;
          stock_item?: { id?: number } | { data?: { id?: number } } | null;
        }
      | undefined;
    const cartProductId = prodPop?.id;
    if (cartProductId == null || !prodPop?.stock_enabled) continue;

    const dbProd = await strapi.db.query('api::producto.producto').findOne({
      where: { id: cartProductId, restaurante: { id: restauranteId } },
      select: ['id', 'stock_enabled', 'stock_quantity', 'stock_min_alert', 'available', 'name'],
    });
    if (!dbProd?.id) {
      strapi?.log?.warn?.(
        `[deductStockForOrder] Producto ${cartProductId} no pertenece al restaurante ${restauranteId}; se omite línea.`,
      );
      continue;
    }
    if (dbProd.stock_quantity == null) continue;

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const previousStock = Number.parseFloat(String(dbProd.stock_quantity));
    if (!Number.isFinite(previousStock)) continue;

    const newStock = Math.max(0, previousStock - qty);

    const updateData: Record<string, unknown> = { stock_quantity: newStock };
    if (newStock <= 0) updateData.available = false;

    await strapi.entityService.update('api::producto.producto', dbProd.id, { data: updateData });

    await strapi.entityService.create('api::movimiento-stock.movimiento-stock', {
      data: {
        type: 'venta',
        quantity: -qty,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_type: 'pedido',
        reference_id: orderId,
        notes: `Pedido #${orderId}`,
        timestamp: nowIso,
        producto: dbProd.id,
        restaurante: restauranteId,
      },
    });

    let stockItemId: number | null = null;
    const si = prodPop.stock_item as Record<string, unknown> | null | undefined;
    if (si && typeof si === 'object') {
      if ('id' in si && si.id != null) stockItemId = Number(si.id) || null;
      else if ('data' in si && si.data && typeof si.data === 'object' && 'id' in (si.data as object)) {
        stockItemId = Number((si.data as { id?: number }).id) || null;
      }
    }
    if (stockItemId == null) {
      const row = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { producto: { id: dbProd.id } },
        select: ['id'],
      });
      stockItemId = row?.id != null ? Number(row.id) : null;
    }

    if (stockItemId != null && stockItemId > 0) {
      const siRow = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: stockItemId, producto: { id: dbProd.id } },
        select: ['id'],
      });
      if (!siRow?.id) {
        strapi?.log?.warn?.(
          `[deductStockForOrder] stock_item ${stockItemId} no coincide con producto ${dbProd.id}; no se crea salida.`,
        );
        continue;
      }

      await strapi.entityService.create('api::stock-movement.stock-movement', {
        data: {
          tipo: 'salida',
          cantidad: qty,
          motivo: `Venta pedido #${orderId}`,
          stock_item: stockItemId,
          publishedAt: nowIso,
        },
      });
    }
  }
}
