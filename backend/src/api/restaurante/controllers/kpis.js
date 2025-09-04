// backend/src/api/restaurante/controllers/kpis.js
'use strict';

function toYMD(d) {
  const x = new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  /**
   * GET /restaurants/:slug/kpis
   * Returns: salesToday, avgTicketToday, top5Products (last 30 days)
   */
  async today(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const now = new Date();
    const startDay = `${toYMD(now)}T00:00:00.000Z`;
    const endDay = `${toYMD(now)}T23:59:59.999Z`;

    const paidToday = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: {
        restaurante: restauranteId,
        order_status: 'paid',
        createdAt: { $gte: startDay, $lte: endDay },
      },
      fields: ['id', 'total'],
      limit: 500,
    });

    const salesToday = (paidToday || []).reduce((s, r) => s + Number(r.total || 0), 0);
    const avgTicketToday = (paidToday?.length ? salesToday / paidToday.length : 0);

    // Top 5 products by quantity in last 30 days (paid orders)
    const from30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const paidLast30 = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: { restaurante: restauranteId, order_status: 'paid', createdAt: { $gt: from30 } },
      fields: ['id'],
      populate: { items: { fields: ['quantity'], populate: { product: { fields: ['name', 'sku'] } } } },
      limit: 1000,
    });

    const counts = new Map();
    for (const o of paidLast30 || []) {
      const items = o.items || [];
      for (const it of items) {
        const name = it.product?.name || it.product?.attributes?.name || 'Producto';
        const qty = Number(it.quantity || 0);
        counts.set(name, (counts.get(name) || 0) + qty);
      }
    }
    const top5 = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    ctx.body = { data: { salesToday, avgTicketToday, top5 } };
  },

  /**
   * GET /restaurants/:slug/export?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Returns CSV of orders (paid by default, unless status param provided)
   */
  async exportCsv(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const { start, end, status } = ctx.request.query || {};

    const from = start ? new Date(`${start}T00:00:00.000Z`).toISOString() : new Date(0).toISOString();
    const to = end ? new Date(`${end}T23:59:59.999Z`).toISOString() : new Date().toISOString();

    const filters = { restaurante: restauranteId, createdAt: { $gte: from, $lte: to } };
    if (status) filters.order_status = status;
    else filters.order_status = 'paid';

    const rows = await strapi.entityService.findMany('api::pedido.pedido', {
      filters,
      sort: { createdAt: 'asc' },
      populate: {
        mesa_sesion: { populate: { mesa: { fields: ['number'] } } },
        items: { populate: { product: { fields: ['name', 'sku'] } } },
      },
      fields: ['id', 'order_status', 'total', 'customerNotes', 'createdAt'],
      limit: 2000,
    });

    const header = ['id', 'createdAt', 'mesa', 'status', 'total', 'items'];
    const lines = [header.join(',')];
    for (const r of rows || []) {
      const mesa = r.mesa_sesion?.mesa?.number
        || r.mesa_sesion?.data?.attributes?.mesa?.data?.attributes?.number
        || '';
      const itemsStr = (r.items || []).map(it => {
        const name = it.product?.name || it.product?.attributes?.name || '';
        const q = it.quantity || 0;
        return `${name} x${q}`;
      }).join(' | ');
      const line = [
        r.id, r.createdAt, mesa, r.order_status, Number(r.total || 0).toFixed(2), `"${itemsStr.replace(/"/g, '""')}"`
      ].join(',');
      lines.push(line);
    }

    const csv = lines.join('\n');
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', `attachment; filename="export_${new Date().toISOString().slice(0,10)}.csv"`);
    ctx.body = csv;
  },
};
