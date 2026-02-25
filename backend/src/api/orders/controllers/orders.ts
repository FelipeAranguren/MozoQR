import { factories } from '@strapi/strapi';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const ORDER_UID = 'api::pedido.pedido';

function getMpAccessToken(strapi: any): string | null {
  const raw = strapi?.config?.get?.('server.mercadopagoToken');
  if (raw == null || typeof raw !== 'string') return null;
  return raw.trim().length > 0 ? raw.trim() : null;
}

async function resolveOrderPk(strapi: any, ref: string | number | null): Promise<number | null> {
  if (ref == null) return null;
  const refStr = String(ref).trim();
  if (/^\d+$/.test(refStr)) {
    try {
      const existing = await strapi.entityService.findOne(ORDER_UID, Number(refStr), { fields: ['id'] });
      if (existing?.id) return existing.id;
    } catch { /* ignore */ }
  }
  try {
    const byDocument = await strapi.db.query(ORDER_UID).findOne({
      where: { documentId: refStr },
      select: ['id'],
    });
    if (byDocument?.id) return byDocument.id;
  } catch { /* ignore */ }
  return null;
}

export default factories.createCoreController(ORDER_UID, ({ strapi }) => ({
  async webhook(ctx) {
    try {
      const body = ctx.request.body || {};
      const type = body.type;
      const dataId = body.data?.id;

      if (type !== 'payment') {
        return ctx.send({ ok: true, message: 'ignored' }, 200);
      }

      if (!dataId) {
        return ctx.send({ ok: false, error: 'data.id required' }, 400);
      }

      const accessToken = getMpAccessToken(strapi);
      if (!accessToken) {
        strapi.log.error('[orders.webhook] Falta mercadopagoToken en config.');
        return ctx.send({ ok: false, error: 'Token not configured' }, 500);
      }

      const client = new MercadoPagoConfig({ accessToken });
      const paymentApi = new Payment(client);
      
      let mpPayment: any;
      try {
        mpPayment = await paymentApi.get({ id: String(dataId) });
      } catch (err: any) {
        return ctx.send({ ok: true, message: 'payment fetch failed' }, 200);
      }

      const status = (mpPayment?.status ?? '').toLowerCase();
      if (status !== 'approved') {
        return ctx.send({ ok: true, message: 'not approved' }, 200);
      }

      const externalRef = mpPayment?.external_reference ?? null;
      if (!externalRef) {
        return ctx.send({ ok: true, message: 'no external_reference' }, 200);
      }

      const orderPk = await resolveOrderPk(strapi, externalRef);
      if (!orderPk) {
        return ctx.send({ ok: true, message: 'order not found' }, 200);
      }

      // IMPORTANTE: Verifica si el campo es 'order_status' o 'status' en tu Content Type
      await strapi.entityService.update(ORDER_UID, orderPk, {
        data: { order_status: 'paid' }, 
      });

      strapi.log.info(`[orders.webhook] Pedido ${orderPk} marcado como paid.`);
      return ctx.send({ ok: true, status: 'paid' }, 200);

    } catch (e: any) {
      strapi.log.error('[orders.webhook] Error:', e.message);
      return ctx.send({ ok: false, error: e.message }, 500);
    }
  },
}));