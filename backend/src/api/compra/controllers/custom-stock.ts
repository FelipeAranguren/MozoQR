/** Instancia Strapi: en algunos despliegues `ctx.strapi` viene vacío; el bootstrap expone `global.__STRAPI__`. */
function getStrapi(ctx: any): any {
  return ctx?.strapi ?? (typeof global !== 'undefined' && (global as any).__STRAPI__) ?? null;
}

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

/**
 * Obtiene el id interno del producto asociado a un stock-item y verifica que pertenezca al restaurante.
 * Acepta populate parcial (solo id, solo documentId, o FK numérico).
 */
async function productoPkFromStockItemRow(
  strapi: any,
  row: { id?: number; producto?: unknown },
  restauranteId: number
): Promise<number | null> {
  const p = row.producto as any;
  if (p == null) return null;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
    const ok = await strapi.db.query('api::producto.producto').findOne({
      where: { id: p, restaurante: { id: restauranteId } },
      select: ['id'],
    });
    return ok?.id != null ? Number(ok.id) : null;
  }
  if (typeof p === 'object') {
    const idVal = p.id;
    if (idVal != null && idVal !== '') {
      const nid = Number(idVal);
      if (Number.isFinite(nid) && nid > 0) {
        const ok = await strapi.db.query('api::producto.producto').findOne({
          where: { id: nid, restaurante: { id: restauranteId } },
          select: ['id'],
        });
        return ok?.id != null ? Number(ok.id) : null;
      }
    }
    const doc = p.documentId;
    if (doc != null && String(doc).trim() !== '') {
      return resolveProductoPk(strapi, String(doc).trim(), restauranteId);
    }
  }
  return null;
}

/** Línea de compra: producto obligatorio en BD; stock_item opcional pero recomendado para stock-movements. */
async function resolveCompraLineProductoAndStockItem(
  strapi: any,
  it: Record<string, unknown>,
  restauranteId: number
): Promise<{ productoPk: number; stockItemPk: number | null } | null> {
  const stockRaw = it.stockItemId ?? it.stock_item_id ?? it.stock_item;
  const prodRaw = it.productoId ?? it.producto;
  const stockStr = stockRaw == null || stockRaw === '' ? '' : String(stockRaw).trim();
  const prodStr = prodRaw == null || prodRaw === '' ? '' : String(prodRaw).trim();

  if (stockStr) {
    const str = stockStr;
    let row: { id?: number; producto?: unknown } | null = null;
    if (/^\d+$/.test(str)) {
      row = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { id: Number(str) },
        populate: { producto: { select: ['id', 'documentId'] } },
      });
    } else {
      row = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { documentId: str },
        populate: { producto: { select: ['id', 'documentId'] } },
      });
    }
    if (row?.id != null) {
      const productoPk = await productoPkFromStockItemRow(strapi, row, restauranteId);
      if (productoPk != null) {
        if (prodStr) {
          const wantedPk = await resolveProductoPk(strapi, prodStr, restauranteId);
          if (wantedPk != null && wantedPk !== productoPk) {
            return null;
          }
        }
        return { productoPk, stockItemPk: Number(row.id) };
      }
    }
  }

  if (!prodStr) return null;
  const productoPk = await resolveProductoPk(strapi, prodStr, restauranteId);
  if (!productoPk) return null;
  return { productoPk, stockItemPk: null };
}

const PRODUCTO_STOCK_UNIT_TO_ITEM: Record<string, 'un' | 'kg' | 'lt' | 'pack'> = {
  unidad: 'un',
  kg: 'kg',
  litro: 'lt',
  porcion: 'un',
};

/**
 * Si el producto aún no tiene stock-item (1:1), lo crea y lo publica para que aparezca en GET live.
 * Asocia la línea de compra al ítem para que "Recibir compra" use movimientos de stock-item.
 */
async function ensureStockItemForProducto(
  strapi: any,
  productoPk: number,
  restauranteId: number,
  unitCost: number
): Promise<number | null> {
  const existing = await strapi.db.query('api::stock-item.stock-item').findOne({
    where: { producto: { id: productoPk } },
    select: ['id'],
  });
  if (existing?.id != null) return Number(existing.id);

  const prod = await strapi.db.query('api::producto.producto').findOne({
    where: { id: productoPk, restaurante: { id: restauranteId } },
    select: ['id', 'name', 'sku', 'stock_unit', 'stock_min_alert', 'stock_quantity'],
  });
  if (!prod?.id) return null;

  const uRaw = prod.stock_unit != null ? String(prod.stock_unit) : 'unidad';
  const unidad = PRODUCTO_STOCK_UNIT_TO_ITEM[uRaw] ?? 'un';
  const sku = `SI-R${restauranteId}-P${prod.id}`;
  const nom = (prod.name && String(prod.name).trim()) || `Producto ${prod.id}`;
  const stockQty = Number(prod.stock_quantity) || 0;
  const minMo = Number(prod.stock_min_alert) || 0;
  const costOk = Number.isFinite(unitCost) && unitCost >= 0;

  const data: Record<string, unknown> = {
    nombre: nom,
    sku,
    stock_actual: stockQty,
    stock_minimo: minMo,
    unidad,
    ...(costOk ? { precio_costo: unitCost } : {}),
    estado: true,
    producto: prod.id,
    publishedAt: new Date(),
  };

  try {
    const created = await strapi.entityService.create('api::stock-item.stock-item', { data });
    if (created?.id != null) return Number(created.id);
  } catch (err: any) {
    strapi.log?.warn?.('[ensureStockItemForProducto] create', err?.message || err);
    const retry = await strapi.db.query('api::stock-item.stock-item').findOne({
      where: { producto: { id: productoPk } },
      select: ['id'],
    });
    if (retry?.id != null) return Number(retry.id);
  }
  return null;
}

/** Cantidad en payload de línea (frontend u otros clientes pueden usar distintos nombres). */
function lineQtyFromPayload(it: Record<string, unknown>): number {
  const q = it.quantity ?? it.cantidad ?? it.qty;
  return Number(q);
}

function lineUnitCostFromPayload(it: Record<string, unknown>): number {
  const c = it.unit_cost ?? it.unitCost ?? it.precio_unitario;
  return Number(c);
}

/**
 * Id numérico interno desde relación populada o FK escalar (Strapi 5 puede devolver
 * número, `{ id }`, `{ data: { id } }` o legacy `{ attributes }`).
 */
function entityNumericId(ref: unknown): number | null {
  if (ref == null || ref === '') return null;
  if (typeof ref === 'number' && Number.isFinite(ref) && ref > 0) return ref;
  if (typeof ref === 'string') {
    const t = ref.trim();
    if (/^\d+$/.test(t)) return Number(t);
    return null;
  }
  if (typeof ref !== 'object') return null;
  const o = ref as Record<string, unknown>;
  if (o.data != null) return entityNumericId(o.data);
  const idTop = o.id;
  if (idTop != null && idTop !== '') {
    const n = typeof idTop === 'number' ? idTop : Number(idTop);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const attrs = o.attributes;
  if (attrs && typeof attrs === 'object') {
    const idA = (attrs as Record<string, unknown>).id;
    if (idA != null && idA !== '') {
      const n = typeof idA === 'number' ? idA : Number(idA);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** Id numérico o documentId para consultas `db.query` por stock-item. */
function entityRefForQuery(ref: unknown): string | number | null {
  const num = entityNumericId(ref);
  if (num != null) return num;
  if (ref != null && typeof ref === 'object') {
    const o = ref as Record<string, unknown>;
    if (o.data != null) return entityRefForQuery(o.data);
    const doc = o.documentId;
    if (doc != null && String(doc).trim() !== '') return String(doc).trim();
  }
  return null;
}

function compraItemsArray(compra: any): any[] {
  const raw = compra?.items;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: any[] }).data;
  }
  return [];
}

/**
 * Suma cantidades de ítems al inventario (stock-item o producto) y registra movimientos.
 * No cambia el estado de la compra; el caller marca `recibida` si corresponde.
 */
/** Cantidad en un ítem de compra (Strapi / decimal / populate anidado). */
function itemCompraQuantity(item: any): number {
  const raw =
    item?.quantity ??
    item?.attributes?.quantity ??
    item?.data?.quantity ??
    (item?.data?.attributes as Record<string, unknown> | undefined)?.quantity;
  if (raw == null) return 0;
  if (typeof raw === 'object' && raw != null && typeof (raw as any).toString === 'function') {
    const n = Number(String(raw));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function itemCompraUnitCost(item: any): number {
  const raw =
    item?.unit_cost ??
    item?.attributes?.unit_cost ??
    item?.data?.unit_cost ??
    (item?.data?.attributes as Record<string, unknown> | undefined)?.unit_cost;
  return Number(raw);
}

async function applyCompraReceiptInventory(
  strapi: any,
  compra: any,
  restauranteId: number,
  user: any
): Promise<void> {
  const now = new Date().toISOString();

  for (const item of compraItemsArray(compra)) {
    const productoPk = entityNumericId((item as any).producto);
    if (productoPk == null) continue;

    const addQty = itemCompraQuantity(item);
    if (addQty <= 0) continue;

    const linkedRef = entityRefForQuery((item as any).stock_item);
    let stockRow: { id?: number; stock_actual?: unknown } | null = null;
    if (linkedRef != null && linkedRef !== '') {
      const s = String(linkedRef).trim();
      if (/^\d+$/.test(s)) {
        stockRow = await strapi.db.query('api::stock-item.stock-item').findOne({
          where: { id: Number(s) },
          select: ['id', 'stock_actual'],
        });
      } else {
        stockRow = await strapi.db.query('api::stock-item.stock-item').findOne({
          where: { documentId: s },
          select: ['id', 'stock_actual'],
        });
      }
    }
    if (!stockRow?.id) {
      stockRow = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { producto: { id: productoPk } },
        select: ['id', 'stock_actual'],
      });
    }

    if (stockRow?.id) {
      const unitCost = itemCompraUnitCost(item);

      // `stock_actual` se actualiza en `stock-movement` `afterCreate` (Query Engine + SQL atómico).
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

      if (Number.isFinite(unitCost) && unitCost > 0) {
        try {
          await strapi.db.query('api::stock-item.stock-item').update({
            where: { id: stockRow.id },
            data: { precio_costo: unitCost },
          });
        } catch (pe: any) {
          strapi.log?.warn?.('[applyCompraReceiptInventory] precio_costo vía db.query', pe?.message || pe);
        }
      }
    } else {
      const pop = (item as any).producto;
      let previousStock = 0;
      if (pop && typeof pop === 'object' && 'stock_quantity' in pop) {
        previousStock = Number((pop as any).stock_quantity) || 0;
      } else {
        const prow = await strapi.db.query('api::producto.producto').findOne({
          where: { id: productoPk },
          select: ['stock_quantity'],
        });
        previousStock = Number(prow?.stock_quantity) || 0;
      }
      const newStock = previousStock + addQty;

      await strapi.entityService.update('api::producto.producto', productoPk, {
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
        producto: productoPk,
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
}

export default {
  /** Id de restaurante resuelto por la policy (misma fuente que compras/stock). Útil para filtros REST en el owner. */
  async ownerContext(ctx: any) {
    ctx.body = {
      data: {
        restauranteId: ctx.state.restauranteId,
        slug: ctx.params.slug,
      },
    };
  },

  async stockOverview(ctx: any) {
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
    const restauranteId = Number(ctx.state.restauranteId);
    const user = ctx.state.user;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { date, supplier, notes, items } = body;

    if (!date) return ctx.badRequest('date es requerido');
    if (!Array.isArray(items)) {
      return ctx.badRequest('items debe ser un array de líneas de compra.');
    }
    if (items.length === 0) {
      return ctx.badRequest(
        'No se puede crear una compra sin líneas. Agregá al menos un ítem con stock_item o producto.'
      );
    }
    if (!Number.isFinite(restauranteId) || restauranteId <= 0) {
      return ctx.badRequest('restaurante inválido');
    }
    if (!strapi) {
      ctx.status = 503;
      ctx.body = { error: { message: 'Strapi no está listo; reintentá en unos segundos.' } };
      return;
    }

    try {
      type ResolvedLine = { productoPk: number; stockItemPk: number | null; qty: number; unitCost: number };
      const resolved: ResolvedLine[] = [];
      let total = 0;
      let line = 0;

      for (const it of items) {
        line += 1;
        if (it == null || typeof it !== 'object') {
          return ctx.badRequest(`Línea ${line}: formato inválido (se esperaba un objeto).`);
        }
        const row = it as Record<string, unknown>;
        const hasQty = row.quantity != null || row.cantidad != null || row.qty != null;
        const hasCost = row.unit_cost != null || row.unitCost != null || row.precio_unitario != null;
        if (!hasQty || !hasCost) {
          return ctx.badRequest('Cada item necesita quantity (o cantidad) y unit_cost (o unitCost).');
        }
        const hasStock = [row.stockItemId, row.stock_item_id, row.stock_item].some(
          (x) => x != null && String(x).trim() !== ''
        );
        const hasProd = [row.productoId, row.producto].some((x) => x != null && String(x).trim() !== '');
        if (!hasStock && !hasProd) {
          return ctx.badRequest(
            `Línea ${line}: falta stockItemId (o stock_item_id) o productoId. No se aceptan referencias nulas o vacías.`
          );
        }
        const ids = await resolveCompraLineProductoAndStockItem(strapi, row, restauranteId);
        if (!ids) {
          return ctx.badRequest(
            `Stock-item o producto inválido o no pertenece a este restaurante (línea ${line}).`
          );
        }
        const qty = lineQtyFromPayload(row);
        const unitCost = lineUnitCostFromPayload(row);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return ctx.badRequest(`Cantidad o costo unitario inválidos (línea ${line})`);
        }
        total += qty * unitCost;
        resolved.push({ productoPk: ids.productoPk, stockItemPk: ids.stockItemPk, qty, unitCost });
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
        ctx.status = 400;
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
        ctx.status = 400;
        ctx.body = { error: { message: 'No se pudo crear la compra (respuesta sin id).' } };
        return;
      }

      for (let i = 0; i < resolved.length; i += 1) {
        const row = resolved[i];
        let stockItemFk: number | null =
          row.stockItemPk != null && Number.isFinite(row.stockItemPk) ? Number(row.stockItemPk) : null;
        if (stockItemFk == null) {
          stockItemFk = await ensureStockItemForProducto(strapi, row.productoPk, restauranteId, row.unitCost);
        }
        const lineTotal = Number((row.qty * row.unitCost).toFixed(2));
        const baseItem: Record<string, unknown> = {
          quantity: row.qty,
          unit_cost: row.unitCost,
          total_cost: lineTotal,
          compra: compraPk,
          producto: row.productoPk,
        };
        const itemData: Record<string, unknown> = { ...baseItem };
        if (stockItemFk != null && Number.isFinite(stockItemFk)) {
          itemData.stock_item = stockItemFk;
        }

        try {
          await strapi.entityService.create('api::item-compra.item-compra', {
            data: itemData,
          });
        } catch (ie: any) {
          const msg0 = String(ie?.message || ie || '');
          const maybeMissingStockCol =
            /stock_item|SQLITE_ERROR|no such column|does not exist|Unknown column/i.test(msg0) &&
            itemData.stock_item != null;
          if (maybeMissingStockCol) {
            strapi.log.warn('[crearCompra] reintento item-compra sin stock_item (columna o relación no disponible)');
            try {
              await strapi.entityService.create('api::item-compra.item-compra', { data: baseItem });
              continue;
            } catch (ie2: any) {
              strapi.log.error(`[crearCompra] falló item-compra línea ${i + 1} (sin stock_item)`, ie2);
              const m2 = ie2?.message || String(ie2);
              if (ie2?.name === 'ValidationError' || ie2?.details?.errors?.length) {
                return ctx.badRequest(m2);
              }
              ctx.status = 400;
              ctx.body = { error: { message: `Ítem ${i + 1}: ${m2}` } };
              return;
            }
          }
          strapi.log.error(`[crearCompra] falló item-compra línea ${i + 1}`, ie);
          const m = ie?.message || String(ie);
          if (ie?.name === 'ValidationError' || ie?.details?.errors?.length) {
            return ctx.badRequest(m);
          }
          ctx.status = 400;
          ctx.body = { error: { message: `Ítem ${i + 1}: ${m}` } };
          return;
        }
      }

      // Respuesta ligera (evita 500 por referencias circulares al serializar populate profundo).
      let full: Record<string, unknown> = {
        id: compraPk,
        documentId: compra?.documentId ?? null,
        date,
        total: Number(total.toFixed(2)),
        status: 'pendiente',
      };
      try {
        const rows = await strapi.db.query('api::item-compra.item-compra').findMany({
          where: { compra: { id: compraPk } },
          select: ['id', 'documentId', 'quantity', 'unit_cost', 'total_cost'],
          populate: { producto: { select: ['id', 'name', 'sku'] } },
          limit: 50,
        });
        full.items = rows ?? [];
      } catch (fe: any) {
        strapi.log.warn('[crearCompra] listado de ítems para respuesta falló', fe?.message);
        full.items = resolved.map((r) => ({
          quantity: r.qty,
          unit_cost: r.unitCost,
          total_cost: Number((r.qty * r.unitCost).toFixed(2)),
          producto: { id: r.productoPk },
        }));
      }

      const rawApl = (body as Record<string, unknown>).aplicar_inventario;
      const aplicarInventario = !(
        rawApl === false ||
        rawApl === 0 ||
        rawApl === 'false' ||
        (typeof rawApl === 'string' && rawApl.trim().toLowerCase() === 'no')
      );

      if (aplicarInventario) {
        const compraFull = await strapi.entityService.findOne('api::compra.compra', compraPk, {
          populate: ['items', 'items.producto', 'items.stock_item', 'restaurante'],
        });
        if (compraFull?.id) {
          await applyCompraReceiptInventory(strapi, compraFull, restauranteId, user);
          await strapi.entityService.update('api::compra.compra', compraPk, {
            data: { status: 'recibida' },
          });
          full.status = 'recibida';
        }
      }

      ctx.body = { data: full };
    } catch (e: any) {
      getStrapi(ctx)?.log?.error?.('[crearCompra] inesperado', e);
      const msg = e?.message || String(e);
      ctx.status = 400;
      ctx.body = { error: { message: `No se pudo crear la compra: ${msg}` } };
    }
  },

  async listarCompras(ctx: any) {
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
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
    const strapi: any = getStrapi(ctx);
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const compraId = ctx.params.id;

    const compra = await strapi.entityService.findOne('api::compra.compra', compraId, {
      populate: ['items', 'items.producto', 'items.stock_item', 'restaurante'],
    });

    if (!compra?.id) return ctx.notFound('Compra no encontrada');
    if (String(compra.restaurante?.id || compra.restaurante) !== String(restauranteId)) {
      return ctx.forbidden('Compra de otro restaurante');
    }
    if (compra.status !== 'pendiente') {
      return ctx.badRequest(`No se puede recibir una compra con estado "${compra.status}"`);
    }

    await applyCompraReceiptInventory(strapi, compra, restauranteId, user);

    const updated = await strapi.entityService.update('api::compra.compra', compraId, {
      data: { status: 'recibida' },
    });

    ctx.body = { data: updated };
  },

  async cancelarCompra(ctx: any) {
    const strapi: any = getStrapi(ctx);
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
