import { EventEmitter } from 'node:events';

export type PagoNotificacion = {
  restauranteId: number;
  restauranteSlug?: string | null;
  mesaNumber: number;
  amount?: number | null;
  currency?: string | null;
  paidAt: string; // ISO
};

const ORDER_UID = 'api::pedido.pedido';

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

const EVENT_NAME = 'mp_payment_approved';

export function onPago(listener: (payload: PagoNotificacion) => void) {
  emitter.on(EVENT_NAME, listener);
  return () => emitter.off(EVENT_NAME, listener);
}

export function emitPago(payload: PagoNotificacion) {
  emitter.emit(EVENT_NAME, payload);
}

export async function persistPagoNotification(
  strapi: any,
  payload: PagoNotificacion,
  mpPaymentId?: string | null,
) {
  const knex = strapi?.db?.connection;
  if (!knex) return;

  const amount =
    payload.amount == null || Number.isNaN(Number(payload.amount))
      ? null
      : Math.round(Number(payload.amount) * 100) / 100;

  const row: Record<string, any> = {
    restaurante_id: payload.restauranteId,
    mesa_number: payload.mesaNumber,
    amount,
    currency: payload.currency ?? null,
    paid_at: payload.paidAt,
    created_at: new Date().toISOString(),
  };

  const mpId = mpPaymentId && String(mpPaymentId).trim() ? String(mpPaymentId).trim() : null;
  if (mpId) {
    row.mp_payment_id = mpId;
  }

  try {
    await knex('payment_notifications').insert(row);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (mpId && (msg.includes('mp_payment_id') || msg.includes('no such column'))) {
      delete row.mp_payment_id;
      await knex('payment_notifications').insert(row);
    } else {
      throw e;
    }
  }

  // Best-effort cleanup: keep recent notifications per restaurante.
  try {
    const rows = await knex('payment_notifications')
      .select('id')
      .where({ restaurante_id: payload.restauranteId })
      .orderBy('paid_at', 'desc')
      .limit(50);
    const keepIds = rows.map((r: any) => r.id).filter(Boolean);
    if (keepIds.length > 0) {
      await knex('payment_notifications')
        .where({ restaurante_id: payload.restauranteId })
        .whereNotIn('id', keepIds)
        .del();
    }
  } catch {
    // ignore
  }
}

/**
 * Carga mesa desde mesaNumber o mesa_sesion.mesa; persiste y emite (Mercado Pago aprobado).
 */
export async function notifyPagoMercadoPagoForOrder(
  strapi: any,
  orderPk: number,
  opts?: {
    amount?: number | null;
    currency?: string | null;
    paidAt?: string;
    mpPaymentId?: string | null;
  },
): Promise<void> {
  const knex = strapi?.db?.connection;
  if (!knex || !strapi?.entityService) return;

  let order: any;
  try {
    order = await strapi.entityService.findOne(ORDER_UID, orderPk, {
      fields: ['id', 'mesaNumber', 'total'],
      populate: {
        restaurante: { fields: ['id', 'slug'] },
        mesa_sesion: { populate: { mesa: { fields: ['number'] } } },
      },
    });
  } catch {
    return;
  }
  if (!order?.id) return;

  const restauranteId = Number(order?.restaurante?.id ?? order?.restaurante);
  const mesaFromSesion = order?.mesa_sesion?.mesa?.number;
  const mesaNumber = Number(order?.mesaNumber ?? mesaFromSesion);

  if (!Number.isFinite(restauranteId) || restauranteId <= 0) return;
  if (!Number.isFinite(mesaNumber) || mesaNumber <= 0) {
    strapi?.log?.warn?.(`[notifyPagoMercadoPagoForOrder] pedido ${orderPk} sin número de mesa (mesaNumber/mesa_sesion).`);
    return;
  }

  const mpId = opts?.mpPaymentId ? String(opts.mpPaymentId).trim() : '';
  if (mpId) {
    try {
      const dup = await knex('payment_notifications').where({ mp_payment_id: mpId }).first();
      if (dup) return;
    } catch {
      // columna inexistente o error — seguir
    }
  }

  const fallbackAmount = Number(order?.total);
  const amount =
    opts?.amount != null && Number.isFinite(Number(opts.amount)) && Number(opts.amount) > 0
      ? Number(opts.amount)
      : Number.isFinite(fallbackAmount) && fallbackAmount > 0
        ? fallbackAmount
        : null;

  const paidAtIso = opts?.paidAt ?? new Date().toISOString();

  const payload: PagoNotificacion = {
    restauranteId,
    restauranteSlug: order?.restaurante?.slug ?? null,
    mesaNumber,
    amount,
    currency: opts?.currency || 'ARS',
    paidAt: paidAtIso,
  };

  try {
    await persistPagoNotification(strapi, payload, mpId || null);
    emitPago(payload);
  } catch (e: any) {
    strapi?.log?.warn?.('[notifyPagoMercadoPagoForOrder] persist/emit failed:', e?.message ?? e);
  }
}
