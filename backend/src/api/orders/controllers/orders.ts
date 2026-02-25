import { factories } from '@strapi/strapi';
import { MercadoPagoConfig, Payment } from 'mercadopago';

/** UID del Content Type pedido en Strapi (api::pedido.pedido) */
const ORDER_UID = 'api::pedido.pedido';

/** Token de MP: solo process.env.MP_ACCESS_TOKEN (Railway reconoce esta variable). */
function getMpAccessToken(): string | null {
  const raw = process.env.MP_ACCESS_TOKEN;
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resuelve el PK numérico del pedido (api::pedido.pedido) a partir de external_reference.
 * Búsqueda dual infalible:
 * - Si external_reference es un número (o string solo dígitos): busca por id.
 * - Si es un string con letras (hash/documentId): busca por documentId.
 * Así funciona con cualquier tipo de ID que use tu Strapi (id numérico o documentId).
 */
async function resolveOrderPk(strapi: any, ref: string | number | null): Promise<number | null> {
  if (ref == null) return null;
  const refStr = String(ref).trim();
  if (refStr === '') return null;

  const isNumeric = typeof ref === 'number' && Number.isInteger(ref) && ref > 0
    || /^\d+$/.test(refStr);

  if (isNumeric) {
    // 1) Búsqueda por id numérico de Strapi (external_reference que envía MP = id del pedido)
    const numId = typeof ref === 'number' ? ref : Number(refStr);
    if (Number.isFinite(numId) && numId > 0) {
      try {
        const byId = await strapi.db.query(ORDER_UID).findOne({
          where: { id: numId },
          select: ['id'],
        });
        if (byId?.id != null) return byId.id;
      } catch {
        /* ignore */
      }
      try {
        const existing = await strapi.entityService.findOne(ORDER_UID, numId, { fields: ['id'] });
        if (existing?.id != null) return existing.id;
      } catch {
        /* ignore */
      }
    }
  }

  // 2) Búsqueda por documentId (external_reference = hash/UID del documento)
  try {
    const byDocument = await strapi.db.query(ORDER_UID).findOne({
      where: { documentId: refStr },
      select: ['id'],
    });
    if (byDocument?.id != null) return byDocument.id;
  } catch {
    /* ignore */
  }

  return null;
}

/** Obtiene merchant order desde la API de Mercado Pago (REST). */
async function getMerchantOrder(accessToken: string, orderId: string): Promise<any> {
  const res = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export default factories.createCoreController(ORDER_UID, ({ strapi }) => ({
  async webhook(ctx) {
    const body = ctx.request.body || {};

    // Log completo para diagnóstico en Railway (pagos reales vs pruebas)
    strapi.log.info('[orders.webhook] body completo recibido:', JSON.stringify(body, null, 2));

    try {
      const type = body.type;
      const dataId = body.data?.id;

      if (!type || dataId == null) {
        if (!dataId && (type === 'payment' || type === 'merchant_order')) {
          return ctx.send({ ok: false, error: 'data.id required' }, 400);
        }
        return ctx.send({ ok: true, message: 'ignored', reason: 'missing type or data.id' }, 200);
      }

      const accessToken = getMpAccessToken();
      if (!accessToken) {
        strapi.log.error('[orders.webhook] Falta MP_ACCESS_TOKEN en variables de entorno (Railway).');
        return ctx.send({ ok: false, error: 'Token not configured' }, 500);
      }

      let externalRef: string | null = null;
      let shouldMarkPaid = false;

      if (type === 'payment') {
        // Notificación de tipo payment: obtener pago y su external_reference
        const client = new MercadoPagoConfig({ accessToken });
        const paymentApi = new Payment(client);
        let mpPayment: any;
        try {
          mpPayment = await paymentApi.get({ id: String(dataId) });
        } catch (err: any) {
          strapi.log.warn('[orders.webhook] payment fetch failed:', err?.message);
          return ctx.send({ ok: true, message: 'payment fetch failed' }, 200);
        }
        const status = (mpPayment?.status ?? '').toLowerCase();
        if (status !== 'approved') {
          return ctx.send({ ok: true, message: 'not approved', status }, 200);
        }
        externalRef = mpPayment?.external_reference ?? null;
        shouldMarkPaid = true;
      } else if (type === 'merchant_order') {
        // Notificación de tipo merchant_order: obtener orden y external_reference; si está cerrada/pagada, marcar
        const mo = await getMerchantOrder(accessToken, String(dataId));
        if (!mo) {
          strapi.log.warn('[orders.webhook] merchant_order fetch failed for id:', dataId);
          return ctx.send({ ok: true, message: 'merchant_order fetch failed' }, 200);
        }
        externalRef = mo.external_reference ?? null;
        const orderStatus = (mo.status ?? '').toLowerCase();
        const hasApprovedPayment = Array.isArray(mo.payments) && mo.payments.some(
          (p: any) => (p.status ?? '').toLowerCase() === 'approved'
        );
        if (orderStatus === 'closed' || hasApprovedPayment) {
          shouldMarkPaid = true;
        } else {
          return ctx.send({ ok: true, message: 'merchant_order not paid', status: orderStatus }, 200);
        }
      } else {
        return ctx.send({ ok: true, message: 'ignored', type }, 200);
      }

      if (!externalRef) {
        return ctx.send({ ok: true, message: 'no external_reference' }, 200);
      }

      const orderPk = await resolveOrderPk(strapi, externalRef);
      if (!orderPk) {
        strapi.log.warn('[orders.webhook] order not found for external_reference:', externalRef);
        return ctx.send({ ok: true, message: 'order not found' }, 200);
      }

      if (!shouldMarkPaid) {
        return ctx.send({ ok: true, message: 'not marked paid' }, 200);
      }

      // api::pedido.pedido usa el campo order_status (no status). Valores: pending | preparing | served | paid | cancelled
      strapi.log.info(`✅ Actualizando pedido ${externalRef} a estado paid.`);
      await strapi.entityService.update(ORDER_UID, orderPk, {
        data: { order_status: 'paid' },
      });

      strapi.log.info(`[orders.webhook] Pedido ${orderPk} (external_ref=${externalRef}) marcado como paid.`);
      return ctx.send({ ok: true, status: 'paid', orderId: orderPk }, 200);
    } catch (e: any) {
      strapi.log.error('[orders.webhook] Error:', e?.message, e?.stack);
      return ctx.send({ ok: false, error: e?.message ?? 'Internal error' }, 500);
    }
  },
}));
