// backend/src/api/restaurante/controllers/products-per-day.js
"use strict";

const DAYJS = require("dayjs");

/**
 * Devuelve la cantidad total de productos (suma de quantities de items)
 * por día, para un restaurante identificado por slug, en un rango [from, to].
 *
 * Query params:
 *  - from (YYYY-MM-DD) opcional, default: hoy - 13 días
 *  - to   (YYYY-MM-DD) opcional, default: hoy
 *  - status opcional (por ej. "paid" o "closed") para filtrar pedidos por estado
 *
 * IMPORTANTE: ajustá los UIDs/fields si en tu esquema tienen otros nombres.
 * - Restaurante: 'api::restaurante.restaurante' (con campo 'slug')
 * - Pedido:      'api::pedido.pedido' (con campos 'restaurante', 'createdAt', 'order_status', 'items')
 * - Item:        relación 'items' con campo numérico 'quantity'
 */
module.exports = {
  async find(ctx) {
    const { slug } = ctx.params || {};
    if (!slug) return ctx.badRequest("Missing slug");

    const { from, to, status } = ctx.query || {};

    const fromISO = from ? new Date(from + "T00:00:00.000Z") : DAYJS().subtract(13, "day").startOf("day").toDate();
    const toISO   = to   ? new Date(to   + "T23:59:59.999Z") : DAYJS().endOf("day").toDate();

    // 1) Buscar restaurante por slug
    const restaurantes = await strapi.entityService.findMany("api::restaurante.restaurante", {
      filters: { slug },
      fields: ["id"],
      publicationState: "live",
      limit: 1,
    });
    const restaurante = restaurantes?.[0];
    if (!restaurante?.id) return ctx.notFound("Restaurante no encontrado");

    // 2) Traer pedidos del período
    //    AJUSTÁ el UID 'api::pedido.pedido' y campos si difieren en tu proyecto.
    const pedidoFilters = {
      restaurante: restaurante.id,
      createdAt: { $gte: fromISO, $lte: toISO },
    };
    if (status) {
      // Si querés filtrar por pagados/cerrados: ?status=paid
      pedidoFilters.order_status = status;
    }

    const pedidos = await strapi.entityService.findMany("api::pedido.pedido", {
      filters: pedidoFilters,
      // Traemos solo lo necesario
      fields: ["id", "createdAt", "order_status"],
      populate: {
        items: {
          fields: ["quantity"], // si tu item se llama distinto, ajustá aquí
        },
      },
      sort: { createdAt: "asc" },
      limit: 10000, // subí si necesitás más
    });

    // 3) Agregar por día la suma de cantidades de items de cada pedido
    const countByDay = new Map(); // key: 'YYYY-MM-DD' -> value: cantidad total
    for (const p of pedidos) {
      const dayKey = DAYJS(p.createdAt).format("YYYY-MM-DD");
      const items = Array.isArray(p.items) ? p.items : [];
      const qtySum = items.reduce((acc, it) => acc + Number(it?.quantity || 0), 0);
      countByDay.set(dayKey, (countByDay.get(dayKey) || 0) + qtySum);
    }

    // 4) Asegurar días vacíos con cero dentro del rango
    const days = DAYJS(toISO).diff(DAYJS(fromISO), "day") + 1;
    const series = Array.from({ length: days }).map((_, i) => {
      const d = DAYJS(fromISO).add(i, "day").format("YYYY-MM-DD");
      return { date: d, quantity: countByDay.get(d) || 0 };
    });

    // 5) Respuesta
    ctx.body = { data: { series, totalQuantity: series.reduce((a, b) => a + b.quantity, 0) } };
  },
};
