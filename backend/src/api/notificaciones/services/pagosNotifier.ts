import { EventEmitter } from 'node:events';

export type PagoNotificacion = {
  restauranteId: number;
  restauranteSlug?: string | null;
  mesaNumber: number;
  amount?: number | null;
  currency?: string | null;
  paidAt: string; // ISO
};

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

export async function persistPagoNotification(strapi: any, payload: PagoNotificacion) {
  const knex = strapi?.db?.connection;
  if (!knex) return;

  const amount =
    payload.amount == null || Number.isNaN(Number(payload.amount))
      ? null
      : Math.round(Number(payload.amount) * 100) / 100;

  await knex('payment_notifications').insert({
    restaurante_id: payload.restauranteId,
    mesa_number: payload.mesaNumber,
    amount,
    currency: payload.currency ?? null,
    paid_at: payload.paidAt,
    created_at: new Date().toISOString(),
  });

  // Best-effort cleanup: keep recent notifications per restaurante.
  // We only need last 3 in UI, but we keep a small buffer (50) to avoid unbounded growth.
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

