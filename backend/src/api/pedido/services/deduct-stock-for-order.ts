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

function parseStockItemIdFromPopulate(prodPop: {
  stock_item?: { id?: number; documentId?: string } | { data?: { id?: number } } | null;
}): number | null {
  const si = prodPop.stock_item as Record<string, unknown> | null | undefined;
  if (si && typeof si === 'object') {
    if ('id' in si && si.id != null) return Number(si.id) || null;
    if ('data' in si && si.data && typeof si.data === 'object' && 'id' in (si.data as object)) {
      return Number((si.data as { id?: number }).id) || null;
    }
  }
  return null;
}

/** Normaliza `product` desde entityService o desde `db.query` (formas distintas en Strapi 5). */
function lineProductFromItem(item: { product?: unknown }): {
  id?: number;
  stock_enabled?: boolean;
  stock_quantity?: unknown;
  stock_min_alert?: unknown;
  available?: boolean;
  name?: string;
  stock_item?: unknown;
} | null {
  const raw = item?.product as Record<string, unknown> | null | undefined;
  if (raw == null) return null;
  if (raw.id != null) return raw as ReturnType<typeof lineProductFromItem>;
  const d = raw.data as Record<string, unknown> | undefined;
  if (d?.id != null) {
    const attrs = (d.attributes as Record<string, unknown>) || {};
    return { ...attrs, id: d.id, documentId: d.documentId, stock_item: attrs.stock_item ?? raw.stock_item } as any;
  }
  return raw as ReturnType<typeof lineProductFromItem>;
}

async function loadItemPedidosForOrder(strapi: any, orderId: number) {
  try {
    const es = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
      filters: { order: { id: { $eq: orderId } } },
      fields: ['id', 'quantity'],
      publicationState: 'preview',
      populate: {
        product: {
          fields: ['id', 'stock_enabled', 'stock_quantity', 'stock_min_alert', 'available', 'name'],
          populate: { stock_item: { fields: ['id', 'documentId'] } },
        },
      },
      limit: 200,
    });
    if (Array.isArray(es) && es.length > 0) return es;
  } catch (e: any) {
    strapi?.log?.warn?.(
      `[deductStockForOrder] findMany item-pedido (preview): ${e?.message || e}; se usa db.query.`,
    );
  }

  /** Fallback: líneas en borrador / filtros que no matchean en entity API. */
  return strapi.db.query('api::item-pedido.item-pedido').findMany({
    where: { order: orderId },
    populate: { product: { populate: { stock_item: true } } },
    limit: 200,
  });
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

  const items = await loadItemPedidosForOrder(strapi, orderId);

  const nowIso = new Date().toISOString();

  for (const item of items) {
    const prodPop = lineProductFromItem(item as { product?: unknown }) as
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
    if (cartProductId == null) continue;

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

    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    let stockItemId: number | null = parseStockItemIdFromPopulate(prodPop);
    if (stockItemId == null) {
      const row = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { producto: { id: dbProd.id } },
        select: ['id'],
      });
      stockItemId = row?.id != null ? Number(row.id) : null;
    }

    const tracksInventory =
      prodPop?.stock_enabled === true || (stockItemId != null && stockItemId > 0);
    if (!tracksInventory) continue;

    const useProductQty = dbProd.stock_quantity != null;

    if (!useProductQty && (stockItemId == null || stockItemId <= 0)) {
      strapi?.log?.warn?.(
        `[deductStockForOrder] producto ${dbProd.id} sin stock_quantity ni stock_item; no hay inventario que descontar.`,
      );
      continue;
    }

    let previousForMov: number;
    let newForMov: number;

    if (useProductQty) {
      const previousStock = Number.parseFloat(String(dbProd.stock_quantity));
      if (!Number.isFinite(previousStock)) continue;
      newForMov = Math.max(0, previousStock - qty);
      previousForMov = previousStock;

      const updateData: Record<string, unknown> = { stock_quantity: newForMov };
      if (newForMov <= 0) updateData.available = false;

      await strapi.entityService.update('api::producto.producto', dbProd.id, { data: updateData });
    } else {
      const siRow = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: stockItemId, producto: { id: dbProd.id } },
        select: ['id', 'stock_actual'],
      });
      if (!siRow?.id) {
        strapi?.log?.warn?.(
          `[deductStockForOrder] stock_item ${stockItemId} no coincide con producto ${dbProd.id}; se omite línea.`,
        );
        continue;
      }
      previousForMov = Number.parseFloat(String(siRow.stock_actual ?? '0'));
      if (!Number.isFinite(previousForMov)) continue;
      newForMov = Math.max(0, previousForMov - qty);
    }

    await strapi.entityService.create('api::movimiento-stock.movimiento-stock', {
      data: {
        type: 'venta',
        quantity: -qty,
        previous_stock: previousForMov,
        new_stock: newForMov,
        reference_type: 'pedido',
        reference_id: orderId,
        notes: `Pedido #${orderId}`,
        timestamp: nowIso,
        producto: dbProd.id,
        restaurante: restauranteId,
      },
    });

    if (stockItemId != null && stockItemId > 0) {
      const siRow = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: stockItemId, producto: { id: dbProd.id } },
        select: ['id', 'stock_actual'],
      });
      if (!siRow?.id) {
        strapi?.log?.warn?.(
          `[deductStockForOrder] stock_item ${stockItemId} no coincide con producto ${dbProd.id}; no se crea salida.`,
        );
        continue;
      }

      const stockActualBefore = Number.parseFloat(String(siRow.stock_actual ?? '0'));
      strapi?.log?.info?.(
        `[deductStockForOrder] orderId=${orderId} productId=${dbProd.id} qty=${qty} stockItemId=${stockItemId} stock_actual_before=${stockActualBefore}`,
      );

      await strapi.entityService.create('api::stock-movement.stock-movement', {
        data: {
          tipo: 'salida',
          cantidad: qty,
          motivo: `Venta pedido #${orderId}`,
          stock_item: stockItemId,
          publishedAt: nowIso,
        },
      });

      const siAfter = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: stockItemId },
        select: ['stock_actual'],
      });
      const stockActualAfter = Number.parseFloat(String(siAfter?.stock_actual ?? 'NaN'));
      strapi?.log?.info?.(
        `[deductStockForOrder] orderId=${orderId} productId=${dbProd.id} qty=${qty} stockItemId=${stockItemId} stock_actual_after=${Number.isFinite(stockActualAfter) ? stockActualAfter : 'n/a'}`,
      );
    }
  }
}
