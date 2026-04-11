import { onPago } from '../services/pagosNotifier';

const RESTAURANTE_UID = 'api::restaurante.restaurante';

/** Tabla física Strapi (collectionName) — el slug en URL puede ser MCDONALDS y en BD mcdonalds. */
const RESTAURANTE_TABLE = 'restaurantes';

async function resolveRestauranteIdBySlug(strapi: any, slug: string): Promise<number | null> {
  if (!slug || typeof slug !== 'string' || !strapi?.db) return null;
  const s = slug.trim();
  if (!s) return null;

  const row = await strapi.db.query(RESTAURANTE_UID).findOne({
    where: { slug: s },
    select: ['id'],
  });
  if (row?.id != null) return Number(row.id);

  const knex = strapi.db.connection;
  if (!knex) return null;
  try {
    const byLower = await knex(RESTAURANTE_TABLE)
      .whereRaw('LOWER(slug) = LOWER(?)', [s])
      .select('id')
      .first();
    return byLower?.id != null ? Number(byLower.id) : null;
  } catch {
    return null;
  }
}

function moneyFmt(amount: any, currency: string | null | undefined) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const cur = (currency || 'ARS').toUpperCase();
  return { amount: Math.round(n * 100) / 100, currency: cur };
}

export default {
  /**
   * GET /api/notificaciones/pagos?slug=:slug
   * Devuelve las últimas 3 notificaciones (persistidas).
   */
  async pagos(ctx: any) {
    const strapi = ctx?.strapi ?? global?.__STRAPI__ ?? null;
    const knex = strapi?.db?.connection;
    if (!knex) {
      ctx.status = 500;
      ctx.body = { ok: false, error: 'DB no disponible' };
      return;
    }

    const slug = (ctx.request.query?.slug ?? '').toString().trim();
    const restauranteId = slug ? await resolveRestauranteIdBySlug(strapi, slug) : null;
    if (slug && !restauranteId) {
      ctx.body = { ok: true, data: [] };
      return;
    }

    const q = knex('payment_notifications')
      .select(['restaurante_id as restauranteId', 'mesa_number as mesaNumber', 'amount', 'currency', 'paid_at as paidAt'])
      .orderBy('paid_at', 'desc')
      .limit(3);

    if (restauranteId) q.where({ restaurante_id: restauranteId });

    const rows = await q;
    ctx.body = {
      ok: true,
      data: (rows || []).map((r: any) => ({
        restauranteId: Number(r.restauranteId),
        mesaNumber: Number(r.mesaNumber),
        ...moneyFmt(r.amount, r.currency),
        paidAt: new Date(r.paidAt).toISOString(),
      })),
    };
  },

  /**
   * GET /api/notificaciones/pagos/stream?slug=:slug
   * Server-Sent Events stream (realtime).
   */
  async pagosStream(ctx: any) {
    const strapi = ctx?.strapi ?? global?.__STRAPI__ ?? null;
    const slug = (ctx.request.query?.slug ?? '').toString().trim();
    const restauranteId = slug ? await resolveRestauranteIdBySlug(strapi, slug) : null;
    if (slug && !restauranteId) {
      ctx.status = 404;
      ctx.body = 'restaurante_not_found';
      return;
    }

    const origin = ctx.get('Origin') || (ctx.request?.headers as any)?.origin;
    if (origin) {
      ctx.set('Access-Control-Allow-Origin', origin);
      ctx.set('Vary', 'Origin');
    }

    ctx.req.setTimeout(0);
    ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
    ctx.set('Cache-Control', 'no-cache, no-transform');
    ctx.set('Connection', 'keep-alive');
    ctx.set('X-Accel-Buffering', 'no');
    ctx.status = 200;

    const res = ctx.res;
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const writePago = (payload: any) => {
      if (restauranteId && Number(payload?.restauranteId) !== Number(restauranteId)) return;
      res.write(`event: mp_payment_approved\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const off = onPago(writePago);

    const keepAlive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch {
        // ignore
      }
    }, 25000);

    ctx.req.on('close', () => {
      clearInterval(keepAlive);
      off();
    });

    ctx.respond = false;
  },
};

