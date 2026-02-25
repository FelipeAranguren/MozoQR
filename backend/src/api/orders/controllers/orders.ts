/**
 * orders controller – webhook para Mercado Pago
 * Recibe notificaciones POST de MP y actualiza el estado de la orden a 'paid' cuando el pago está aprobado.
 */

import { MercadoPagoConfig, Payment } from 'mercadopago';

const ORDER_UID = 'api::pedido.pedido';

/** Token desde config/server.ts → mercadopagoToken (no hardcodeado). */
function getMpAccessToken(strapi: any): string | null {
  const raw = strapi?.config?.get?.('server.mercadopagoToken');
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Resuelve el PK del pedido por id numérico o documentId. */
async function resolveOrderPk(strapi: any, ref: string | number | null): Promise<number | null> {
  if (ref == null) return null;
  const refStr = String(ref).trim();
  if (/^\d+$/.test(refStr)) {
    try {
      const existing = await strapi.entityService.findOne(ORDER_UID, Number(refStr), { fields: ['id'] });
      if (existing?.id) return existing.id;
    } catch {
      /* ignore */
    }
  }
  try {
    const byDocument = await strapi.db.query(ORDER_UID).findOne({
      where: { documentId: refStr },
      select: ['id'],
    });
    if (byDocument?.id) return byDocument.id;
  } catch {
    /* ignore */
  }
  return null;
}

export default {
  /**
   * POST /api/orders/webhook
   * Endpoint público. Mercado Pago envía: { type: 'payment', data: { id: '<payment_id>' } }.
   * Si type === 'payment', se consulta el pago por ID; si status === 'approved', se marca la orden (external_reference) como 'paid'.
   */
  async webhook(ctx: any) {
    const strapi = ctx.strapi;

    try {
      const body = ctx.request.body || {};
      const type = body.type;
      const dataId = body.data?.id;

      if (type !== 'payment') {
        strapi?.log?.info?.(`[orders.webhook] Ignorando type="${type}".`);
        ctx.status = 200;
        ctx.body = { ok: true, message: 'ignored' };
        return;
      }

      if (!dataId) {
        strapi?.log?.warn?.('[orders.webhook] type=payment pero falta data.id.');
        ctx.status = 400;
        ctx.body = { ok: false, error: 'data.id required' };
        return;
      }

      const accessToken = getMpAccessToken(strapi);
      if (!accessToken) {
        strapi?.log?.error?.('[orders.webhook] Falta mercadopagoToken en config (server.mercadopagoToken).');
        ctx.status = 500;
        ctx.body = { ok: false, error: 'Mercado Pago token not configured' };
        return;
      }

      const client = new MercadoPagoConfig({ accessToken });
      const paymentApi = new Payment(client);
      let mpPayment: any;
      try {
        mpPayment = await paymentApi.get({ id: String(dataId) });
      } catch (err: any) {
        strapi?.log?.warn?.(`[orders.webhook] No se pudo obtener pago ${dataId}: ${err?.message}`);
        ctx.status = 200;
        ctx.body = { ok: true, message: 'payment fetch failed' };
        return;
      }

      const status = (mpPayment?.status ?? '').toLowerCase();
      if (status !== 'approved') {
        strapi?.log?.info?.(`[orders.webhook] Pago ${dataId} no aprobado (status=${status}).`);
        ctx.status = 200;
        ctx.body = { ok: true, message: 'not approved' };
        return;
      }

      const externalRef = mpPayment?.external_reference ?? mpPayment?.metadata?.order_id ?? null;
      if (!externalRef) {
        strapi?.log?.warn?.(`[orders.webhook] Pago ${dataId} aprobado pero sin external_reference.`);
        ctx.status = 200;
        ctx.body = { ok: true, message: 'no external_reference' };
        return;
      }

      const orderPk = await resolveOrderPk(strapi, externalRef);
      if (!orderPk) {
        strapi?.log?.warn?.(`[orders.webhook] Pedido no encontrado para external_reference=${externalRef}.`);
        ctx.status = 200;
        ctx.body = { ok: true, message: 'order not found' };
        return;
      }

      await strapi.entityService.update(ORDER_UID, orderPk, {
        data: { order_status: 'paid' },
      });

      strapi?.log?.info?.(`[orders.webhook] Pedido ${orderPk} marcado como paid (pago ${dataId}).`);
      ctx.status = 200;
      ctx.body = { ok: true, orderId: orderPk, status: 'paid' };
    } catch (e: any) {
      strapi?.log?.error?.('[orders.webhook] Error:', e?.message, e?.stack);
      ctx.status = 500;
      ctx.body = { ok: false, error: e?.message ?? 'Webhook error' };
    }
  },
};
