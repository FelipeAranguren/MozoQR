import mercadopago from 'mercadopago';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:1337';

if (!ACCESS_TOKEN) {
  // Aviso en arranque si falta token
  console.warn('[MercadoPago] MP_ACCESS_TOKEN no configurado');
} else {
  mercadopago.configure({ access_token: ACCESS_TOKEN });
}

export default {
  /**
   * Crea una preferencia de Checkout Pro.
   * Body esperado (flexible):
   *  - orderId: number | string
   *  - items?: [{ title, quantity, unit_price, currency_id }]
   *  - amount?: number (si no hay items)
   *  - payer_email?: string
   *  - back_urls?: { success, pending, failure }
   *
   * Si no mandás items ni amount, intenta leer el total desde el pedido (best-effort).
   */
  async createPreference(ctx) {
    try {
      const { orderId, items, amount, payer_email, back_urls } = ctx.request.body || {};

      if (!orderId) {
        return (ctx.badRequest) ? ctx.badRequest('orderId es requerido') : (ctx.response.status = 400);
      }

      // 1) Determinar items para MP
      let mpItems = items;

      // Si no nos mandaron items, tratamos de inferir desde el pedido
      if (!mpItems) {
        // best-effort: intenta cargar pedido y sumar
        let order = null;
        try {
          order = await strapi.entityService.findOne('api::pedido.pedido', orderId, { populate: { items: true } });
        } catch (e) {
          // no cortar; solo seguimos
        }

        // a) si hay amount, usar amount único
        if (typeof amount === 'number') {
          mpItems = [{
            title: `Pedido #${orderId}`,
            quantity: 1,
            unit_price: Number(amount),
            currency_id: 'ARS'
          }];
        }
        // b) si hay order con items y estructura conocida (price * qty)
        else if (order?.items?.length) {
          const guessed = order.items.map(it => {
            const qty = Number(it.quantity ?? it.qty ?? 1);
            const price = Number(it.price ?? it.unit_price ?? 0);
            return {
              title: it.name ?? it.title ?? `Item ${it.id ?? ''}`,
              quantity: qty || 1,
              unit_price: price || 0,
              currency_id: 'ARS'
            };
          }).filter(x => x.unit_price > 0);
          mpItems = guessed.length ? guessed : null;
        }
        // c) como último recurso, intentamos campos típicos de pedido
        else if (order && (order.total || order.total_amount || order.montoTotal)) {
          const total =
            Number(order.total) ||
            Number(order.total_amount) ||
            Number(order.montoTotal);
          mpItems = [{
            title: `Pedido #${orderId}`,
            quantity: 1,
            unit_price: total || 0,
            currency_id: 'ARS'
          }];
        }
      }

      if (!mpItems || !mpItems.length) {
        return ctx.badRequest('No se pudieron determinar los items/amount para la preferencia.');
      }

      // 2) Back URLs & notification
      const defaultBackUrls = {
        success: `${FRONTEND_URL}/checkout/success?orderId=${orderId}`,
        failure: `${FRONTEND_URL}/checkout/failure?orderId=${orderId}`,
        pending: `${FRONTEND_URL}/checkout/pending?orderId=${orderId}`
      };

      const preferencePayload = {
        items: mpItems,
        external_reference: String(orderId), // clave para reconciliar en webhook
        payer: payer_email ? { email: payer_email } : undefined,
        back_urls: back_urls || defaultBackUrls,
        auto_return: 'approved',
        notification_url: `${BACKEND_URL}/api/mercadopago/webhook`
      };

      const { body: pref } = await mercadopago.preferences.create(preferencePayload);

      // 3) Persistir Payment en Strapi
      const amountSum = mpItems.reduce((acc, it) => acc + (Number(it.unit_price) * Number(it.quantity || 1)), 0);

      const paymentRecord = await strapi.entityService.create('api::payment.payment', {
        data: {
          order: orderId,
          status: 'init',
          amount: amountSum,
          currency_id: mpItems[0]?.currency_id || 'ARS',
          external_reference: String(orderId),
          mp_preference_id: pref.id,
          init_point: pref.init_point,
          sandbox_init_point: pref.sandbox_init_point,
          raw_preference: pref
        }
      });

      ctx.body = {
        ok: true,
        preference_id: pref.id,
        init_point: pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
        payment_id: paymentRecord.id
      };
    } catch (err) {
      console.error('[MP createPreference] error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: 'Error creando preferencia' };
    }
  },

  /**
   * Webhook Mercado Pago
   * MP envía notificaciones con query/body. Nos interesa type=payment o topic=payment.
   * Tomamos data.id y consultamos el pago para actualizar nuestro registro.
   */
  async webhook(ctx) {
    try {
      // Guarda raw para auditoría
      const raw = {
        headers: ctx.request.headers,
        query: ctx.request.query,
        body: ctx.request.body
      };

      const topic = ctx.request.query.topic || ctx.request.query.type;
      const id = ctx.request.query['data.id'] || ctx.request.query.id || ctx.request.body?.data?.id;

      // Persistimos la notificación en algún payment si ya sabemos cuál es (si no, igual seguimos)
      // Cuando es topic=payment, consultamos el pago para obtener external_reference.
      if (topic === 'payment' && id) {
        // Consultar el pago
        const { body: payment } = await mercadopago.payment.findById(id);

        const externalRef = payment?.external_reference || payment?.metadata?.order_id;
        const status = payment?.status; // approved, pending, rejected, etc.
        const paidAt = payment?.date_approved ? new Date(payment.date_approved) : null;
        const mpPaymentId = String(payment?.id);

        // Buscar el Payment por external_reference + estado init/pending
        // o por preference id si viene en additional_info (según tu flujo).
        let record = null;

        if (externalRef) {
          const found = await strapi.entityService.findMany('api::payment.payment', {
            filters: { external_reference: String(externalRef) },
            sort: { id: 'desc' },
            limit: 1
          });
          record = found?.[0] || null;
        }

        if (record) {
          await strapi.entityService.update('api::payment.payment', record.id, {
            data: {
              status: status || record.status,
              mp_payment_id: mpPaymentId || record.mp_payment_id,
              paid_at: paidAt || record.paid_at,
              raw_notification: raw,
              raw_payment: payment
            }
          });
        } else {
          // Si no encontramos por external_reference, al menos guardamos algo suelto
          await strapi.entityService.create('api::payment.payment', {
            data: {
              status,
              external_reference: externalRef ? String(externalRef) : undefined,
              mp_payment_id: mpPaymentId,
              paid_at: paidAt,
              raw_notification: raw,
              raw_payment: payment
            }
          });
        }

        ctx.body = { received: true };
        return;
      }

      // Otros tópicos (merchant_order, etc.) — por ahora sólo confirmamos recepción
      ctx.body = { received: true };
    } catch (err) {
      console.error('[MP webhook] error', err);
      ctx.status = 500;
      ctx.body = { ok: false };
    }
  }
};
