/**
 * Tras persistir un movimiento, sincroniza `stock_item.stock_actual`.
 * El Document Service a veces no aplica bien updates previos al mismo ítem; el incremento queda acoplado al alta del movimiento.
 */
function getStrapi(): any {
  return typeof global !== 'undefined' && (global as any).__STRAPI__ ? (global as any).__STRAPI__ : null;
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

function parseCantidad(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'object' && raw != null && typeof (raw as any).toString === 'function') {
    const n = Number(String(raw));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
      if (first) return parseStockItemFk(first.id ?? first.documentId ?? first);
    }
  }
  return parseStockItemFk(s);
}

export default {
  async afterCreate(event: any) {
    const strapi = getStrapi();
    if (!strapi) return;

    const result = event?.result;
    if (!result) return;

    const tipo = result.tipo;
    if (tipo !== 'entrada' && tipo !== 'salida') return;

    const paramsData = event?.params?.data as Record<string, unknown> | undefined;
    const stockItemId =
      parseStockItemFk(result.stock_item) ?? parseStockItemFromCreateData(paramsData);
    if (stockItemId == null) return;

    const qty = parseCantidad(result.cantidad ?? (paramsData as any)?.cantidad);
    if (qty <= 0) return;

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
