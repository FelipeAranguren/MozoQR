/**
 * Tras persistir un movimiento, sincroniza `stock_item.stock_actual`.
 * Strapi 5 a veces expone relaciones solo con `documentId` en `event.result`;
 * se reintenta con `event.params.data` y, si hace falta, con una lectura al movimiento recién creado.
 */
function getStrapiApp(): any {
  const g = typeof global !== 'undefined' ? (global as any) : null;
  return g?.__STRAPI__ ?? g?.strapi ?? null;
}

function parseStockItemFk(rel: unknown): number | null {
  if (rel == null || rel === '') return null;
  if (typeof rel === 'number' && Number.isFinite(rel) && rel > 0) return rel;
  if (typeof rel === 'string') {
    const t = rel.trim();
    if (/^\d+$/.test(t)) return Number(t);
    return null;
  }
  if (typeof rel === 'object') {
    const o = rel as Record<string, unknown>;
    if (o.data != null) return parseStockItemFk(o.data);
    const idTop = o.id;
    if (idTop != null && idTop !== '') {
      const n = typeof idTop === 'number' ? idTop : Number(idTop);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** FK de stock_item en el payload de create (Strapi 5: id, connect, documentId). */
function parseStockItemFromCreateData(data: Record<string, unknown> | undefined): number | null {
  if (!data) return null;
  const s = data.stock_item as unknown;
  if (s == null) return null;
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    const o = s as Record<string, unknown>;
    if (Array.isArray(o.connect)) {
      const first = o.connect[0] as Record<string, unknown> | undefined;
      if (first) {
        const fromConnect = parseStockItemFk(first.id ?? first.documentId ?? first);
        if (fromConnect != null) return fromConnect;
      }
    }
    return parseStockItemFk(s);
  }
  return parseStockItemFk(s);
}

function parseCantidad(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (typeof raw === 'object' && raw != null) {
    try {
      const v = Number((raw as { valueOf?: () => unknown }).valueOf?.());
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      /* ignore */
    }
    const s = String(raw);
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function resolveStockItemInternalId(strapi: any, event: any): Promise<number | null> {
  const result = event?.result;
  const paramsData = event?.params?.data as Record<string, unknown> | undefined;

  let id =
    parseStockItemFk(result?.stock_item) ??
    parseStockItemFromCreateData(paramsData) ??
    parseStockItemFk(paramsData?.stock_item);

  if (id != null) return id;

  const rel = (result?.stock_item ?? paramsData?.stock_item) as Record<string, unknown> | undefined;
  if (rel && typeof rel === 'object') {
    const doc = rel.documentId;
    if (doc != null && String(doc).trim() !== '') {
      const row = await strapi.db.query('api::stock-item.stock-item').findOne({
        where: { documentId: String(doc).trim() },
        select: ['id'],
      });
      if (row?.id != null) return Number(row.id);
    }
  }

  const movNumId = result?.id != null && result.id !== '' ? Number(result.id) : NaN;
  if (Number.isFinite(movNumId) && movNumId > 0) {
    const row = await strapi.db.query('api::stock-movement.stock-movement').findOne({
      where: { id: movNumId },
      populate: { stock_item: { select: ['id'] } },
    });
    const si = (row as { stock_item?: unknown })?.stock_item;
    return parseStockItemFk(si);
  }

  const movDoc = result?.documentId;
  if (movDoc != null && String(movDoc).trim() !== '') {
    const row = await strapi.db.query('api::stock-movement.stock-movement').findOne({
      where: { documentId: String(movDoc).trim() },
      populate: { stock_item: { select: ['id'] } },
    });
    const si = (row as { stock_item?: unknown })?.stock_item;
    return parseStockItemFk(si);
  }

  return null;
}

export default {
  async afterCreate(event: any) {
    const strapi = getStrapiApp();
    if (!strapi) return;

    const result = event?.result;
    if (!result) return;

    const tipo = result.tipo;
    if (tipo !== 'entrada' && tipo !== 'salida') return;

    const paramsData = event?.params?.data as Record<string, unknown> | undefined;
    const stockItemId = await resolveStockItemInternalId(strapi, event);
    if (stockItemId == null) {
      strapi.log?.warn?.(
        '[stock-movement lifecycles] afterCreate: no se pudo resolver stock_item; stock_actual no se actualiza.'
      );
      return;
    }

    const qty = parseCantidad(result.cantidad ?? paramsData?.cantidad);
    if (qty <= 0) {
      strapi.log?.warn?.('[stock-movement lifecycles] afterCreate: cantidad inválida o <= 0; se omite sync.');
      return;
    }

    const knex = strapi.db?.connection;
    const table = 'stock_items';

    try {
      if (tipo === 'entrada') {
        if (knex?.raw) {
          await knex(table).where({ id: stockItemId }).update({
            stock_actual: knex.raw('COALESCE(stock_actual, 0) + ?', [qty]),
          });
        } else {
          const row = await strapi.db.query('api::stock-item.stock-item').findOne({
            where: { id: stockItemId },
            select: ['id', 'stock_actual'],
          });
          if (!row?.id) return;
          const next = (Number(row.stock_actual) || 0) + qty;
          await strapi.db.query('api::stock-item.stock-item').update({
            where: { id: stockItemId },
            data: { stock_actual: next },
          });
        }
      } else {
        const row = await strapi.db.query('api::stock-item.stock-item').findOne({
          where: { id: stockItemId },
          select: ['id', 'stock_actual'],
        });
        if (!row?.id) return;
        const prev = Number(row.stock_actual) || 0;
        const next = Math.max(0, prev - qty);
        await strapi.db.query('api::stock-item.stock-item').update({
          where: { id: stockItemId },
          data: { stock_actual: next },
        });
      }
    } catch (err: any) {
      strapi.log?.error?.('[stock-movement lifecycles] afterCreate sync stock_item', err?.message || err);
    }
  },
};
