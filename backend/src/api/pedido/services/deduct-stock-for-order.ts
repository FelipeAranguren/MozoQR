/**
 * Descuenta inventario una vez por pedido: `producto.stock_quantity` + movimiento-stock legacy,
 * y si existe `stock-item` vinculado, crea `stock-movement` tipo salida (sincroniza `stock_actual` vía lifecycle).
 *
 * Flujo recomendado (menú): se llama al **crear** el pedido con sus líneas (`scoped-orders.create`, `tenant.createOrder`)
 * para que el stock baje al pedir. Sigue invocándose al pasar a `order_status: 'paid'` (lifecycle, pagos, etc.); la
 * idempotencia vía `movimiento-stock` (`reference_type: 'pedido'`, `reference_id` = id interno del pedido) hace que
 * el segundo intento no duplique descuentos ni movimientos.
 *
 * No debe lanzar: usar `safeDeductStockForPaidOrder` (nombre histórico; aplica también al pedido recién creado).
 */

export async function safeDeductStockForPaidOrder(
  strapi: any,
  orderRef: number | string,
  restauranteId: number,
) {
  try {
    await deductStockForOrder(strapi, orderRef, restauranteId);
  } catch (err: any) {
    strapi?.log?.error?.(
      `[deductStockForOrder] Fallo no controlado (pedido ${String(orderRef)}):`,
      err?.message ?? err,
    );
  }
}

/**
 * Tras `entityService.update` que marca `order_status: paid` (pasarelas, webhooks), el lifecycle del pedido
 * debería descontar; en despliegues donde `getStrapiApp()` falla en lifecycles, esto evita stock sin mover.
 */
export async function safeDeductStockAfterPedidoMarkedPaid(strapi: any, orderPk: number) {
  try {
    const full = await strapi.entityService.findOne('api::pedido.pedido', orderPk, {
      fields: ['id'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!full?.id) return;
    const r = full.restaurante as { id?: number } | number | undefined;
    const rid =
      typeof r === 'number'
        ? r
        : r && typeof r === 'object' && r.id != null
          ? Number(r.id)
          : null;
    if (rid == null || !Number.isFinite(rid)) return;
    strapi?.log?.info?.(
      `[deductStockForOrder] payment/mark path → safeDeductStockForPaidOrder pedido=${orderPk} restauranteId=${rid}`,
    );
    await safeDeductStockForPaidOrder(strapi, orderPk, rid);
  } catch (err: any) {
    strapi?.log?.warn?.(`[deductStockForOrder] safeDeductStockAfterPedidoMarkedPaid: ${err?.message ?? err}`);
  }
}

/** Strapi 5: el update puede identificar el pedido por `id` numérico o `documentId`; las líneas guardan FK al id interno. */
async function resolvePedidoInternalId(strapi: any, ref: string | number | undefined | null): Promise<number | null> {
  if (ref == null || ref === '') return null;
  if (typeof ref === 'number' && Number.isFinite(ref) && ref > 0) {
    const row = await strapi.db.query('api::pedido.pedido').findOne({
      where: { id: ref },
      select: ['id'],
    });
    if (row?.id != null) return Number(row.id);
  }
  const s = String(ref).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const row = await strapi.db.query('api::pedido.pedido').findOne({
      where: { id: Number(s) },
      select: ['id'],
    });
    if (row?.id != null) return Number(row.id);
  }
  const byDoc = await strapi.db.query('api::pedido.pedido').findOne({
    where: { documentId: s },
    select: ['id'],
  });
  return byDoc?.id != null ? Number(byDoc.id) : null;
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

async function loadItemPedidosForOrder(strapi: any, orderPk: number) {
  /** Preferir DB: evita filtros raros del entity API y líneas en borrador sin publicar. */
  try {
    let rows = await strapi.db.query('api::item-pedido.item-pedido').findMany({
      where: { order: orderPk },
      populate: { product: { populate: { stock_item: true } } },
      limit: 200,
    });
    if ((!Array.isArray(rows) || rows.length === 0) && Number.isFinite(orderPk)) {
      rows = await strapi.db.query('api::item-pedido.item-pedido').findMany({
        where: { order: { id: orderPk } },
        populate: { product: { populate: { stock_item: true } } },
        limit: 200,
      });
    }
    if (Array.isArray(rows) && rows.length > 0) {
      strapi?.log?.info?.(`[deductStockForOrder] pedido ${orderPk}: ${rows.length} línea(s) item-pedido (db.query).`);
      return rows;
    }
  } catch (e: any) {
    strapi?.log?.warn?.(`[deductStockForOrder] db.query item-pedido: ${e?.message || e}`);
  }

  try {
    const es = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
      filters: { order: orderPk },
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
    if (Array.isArray(es) && es.length > 0) {
      strapi?.log?.info?.(`[deductStockForOrder] pedido ${orderPk}: ${es.length} línea(s) (entityService preview).`);
      return es;
    }
  } catch (e: any) {
    strapi?.log?.warn?.(`[deductStockForOrder] findMany item-pedido: ${e?.message || e}`);
  }

  strapi?.log?.warn?.(`[deductStockForOrder] pedido ${orderPk}: sin líneas item-pedido.`);
  return [];
}

async function stockItemRefForMovementCreate(strapi: any, stockItemInternalId: number): Promise<string | number> {
  const row = await strapi.db.query('api::stock-item.stock-item').findOne({
    where: { id: stockItemInternalId },
    select: ['id', 'documentId'],
  });
  if (row?.documentId != null && String(row.documentId).trim() !== '') {
    return String(row.documentId).trim();
  }
  return stockItemInternalId;
}

export async function deductStockForOrder(
  strapi: any,
  orderRef: string | number,
  restauranteId: number,
) {
  const orderPk = await resolvePedidoInternalId(strapi, orderRef);
  if (orderPk == null || !Number.isFinite(orderPk)) {
    strapi?.log?.warn?.(`[deductStockForOrder] pedido no resuelto: ref=${String(orderRef)}`);
    return;
  }

  const existing = await strapi.entityService.findMany('api::movimiento-stock.movimiento-stock', {
    filters: { reference_type: 'pedido', reference_id: orderPk },
    fields: ['id'],
    limit: 1,
  });
  if (Array.isArray(existing) && existing.length > 0) {
    strapi?.log?.info?.(`[deductStockForOrder] pedido ${orderPk}: ya hay movimiento-stock (idempotente).`);
    return;
  }

  const items = await loadItemPedidosForOrder(strapi, orderPk);

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
    if (useProductQty && stockItemId != null && stockItemId > 0) {
      strapi?.log?.warn?.(
        `[deductStockForOrder] producto ${dbProd.id}: tiene stock_quantity y stock-item; se usa rama legacy (producto). ` +
          `Para inventario solo en stock-item, dejá stock_quantity en null.`,
      );
    }

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
        reference_id: orderPk,
        notes: `Pedido #${orderPk}`,
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
        `[deductStockForOrder] orderPk=${orderPk} productId=${dbProd.id} qty=${qty} stockItemId=${stockItemId} stock_actual_before=${stockActualBefore}`,
      );

      try {
        const stockRel = await stockItemRefForMovementCreate(strapi, stockItemId);
        await strapi.entityService.create('api::stock-movement.stock-movement', {
          data: {
            tipo: 'salida',
            cantidad: qty,
            motivo: `Venta pedido #${orderPk}`,
            stock_item: stockRel,
            publishedAt: nowIso,
          },
        });
      } catch (smErr: any) {
        strapi?.log?.error?.(
          `[deductStockForOrder] crear stock-movement salida pedido ${orderPk} producto ${dbProd.id}:`,
          smErr?.message ?? smErr,
        );
      }

      const siAfter = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: stockItemId },
        select: ['stock_actual'],
      });
      const stockActualAfter = Number.parseFloat(String(siAfter?.stock_actual ?? 'NaN'));
      strapi?.log?.info?.(
        `[deductStockForOrder] orderPk=${orderPk} productId=${dbProd.id} qty=${qty} stockItemId=${stockItemId} stock_actual_after=${Number.isFinite(stockActualAfter) ? stockActualAfter : 'n/a'}`,
      );
    }
  }
}
