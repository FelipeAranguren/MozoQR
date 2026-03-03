/**
 * products-per-day controller
 */

declare const strapi: any;

function toYMD(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
}

export default {
    async find(ctx: any) {
        const { slug } = ctx.params || {};
        if (!slug) return ctx.badRequest("Missing slug");

        const { from, to, status } = ctx.query || {};

        // Default: last 13 days
        // Note: Using UTC dates to match dayjs behavior in original code roughly
        const now = new Date();
        const defaultFrom = new Date(now);
        defaultFrom.setDate(now.getDate() - 13);
        defaultFrom.setUTCHours(0, 0, 0, 0);

        const defaultTo = new Date(now);
        defaultTo.setUTCHours(23, 59, 59, 999);

        const fromISO = from ? new Date(from + "T00:00:00.000Z") : defaultFrom;
        const toISO = to ? new Date(to + "T23:59:59.999Z") : defaultTo;

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
        const pedidoFilters: any = {
            restaurante: restaurante.id,
            createdAt: { $gte: fromISO.toISOString(), $lte: toISO.toISOString() },
        };
        if (status) {
            pedidoFilters.order_status = status;
        }

        const pedidos = await strapi.entityService.findMany("api::pedido.pedido", {
            filters: pedidoFilters,
            fields: ["id", "createdAt", "order_status"],
            populate: {
                items: {
                    fields: ["quantity"],
                },
            },
            sort: { createdAt: "asc" },
            limit: 10000,
        });

        // 3) Agregar por día la suma de cantidades de items de cada pedido
        const countByDay = new Map(); // key: 'YYYY-MM-DD' -> value: cantidad total
        for (const p of pedidos) {
            const dayKey = toYMD(new Date(p.createdAt));
            const items = Array.isArray(p.items) ? p.items : [];
            const qtySum = items.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0), 0);
            countByDay.set(dayKey, (countByDay.get(dayKey) || 0) + qtySum);
        }

        // 4) Asegurar días vacíos con cero dentro del rango
        const diffTime = Math.abs(toISO.getTime() - fromISO.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Note: diffDays might be slightly off depending on time boundaries, but loop below handles it.

        const series = [];
        let current = new Date(fromISO);
        // Normalize current to start of day for iteration
        current.setUTCHours(0, 0, 0, 0);

        // Iterate until we pass toISO date part
        while (current <= toISO || toYMD(current) === toYMD(toISO)) {
            const d = toYMD(current);
            series.push({ date: d, quantity: countByDay.get(d) || 0 });
            current.setDate(current.getDate() + 1);
            if (series.length > 365) break; // Safety break
        }

        // 5) Respuesta
        ctx.body = { data: { series, totalQuantity: series.reduce((a, b) => a + b.quantity, 0) } };
    },
};
