//backend/src/api/payments/controllers/payments.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

declare const strapi: any;

function ensureHttpUrl(u?: string | null, fallback = 'http://localhost:5173'): string {
  const s = String(u || '').trim();
  if (!s) return fallback;
  if (!/^https?:\/\//i.test(s)) return `http://${s.replace(/^\/*/, '')}`;
  return s;
}

function resolvePaymentUID(): string | null {
  // Soporta ambos UIDs según cómo hayas creado el CT
  const uid1 = 'api::payment.payment';
  const uid2 = 'api::payments.payment';
  // @ts-ignore
  const has1 = !!(strapi?.contentTypes && strapi.contentTypes[uid1]);
  // @ts-ignore
  const has2 = !!(strapi?.contentTypes && strapi.contentTypes[uid2]);
  if (has1) return uid1;
  if (has2) return uid2;
  return null;
}

export default {
  async ping(ctx: any) {
    ctx.body = { ok: true, msg: 'payments api up' };
  },

  async createPreference(ctx: any) {
    try {
      const { items, orderId, amount, payer_email, back_urls } = ctx.request.body || {};

      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) {
        ctx.status = 500;
        ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
        return;
      }

      // ---- Normalización de monto/ítems
      const hasItems = Array.isArray(items) && items.length > 0;
      const numericAmount = typeof amount === 'number' ? Number(amount) : Number.NaN;
      if (!hasItems && (!numericAmount || Number.isNaN(numericAmount))) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Debés enviar items o amount (> 0).' };
        return;
      }

      const saneItems = hasItems
        ? items.map((it: any) => {
            const quantity = Number(it.quantity ?? it.qty ?? 1);
            const unit_price = Number(it.unit_price ?? it.price ?? it.precio ?? 0);
            const title = String(it.title ?? it.nombre ?? 'Pedido');
            if (!quantity || !unit_price || Number.isNaN(quantity) || Number.isNaN(unit_price)) {
              throw new Error('quantity/unit_price inválidos (>0)');
            }
            return { title, quantity, unit_price, currency_id: 'ARS' as const };
          })
        : [
            {
              title: orderId ? `Pedido #${orderId}` : 'Pago',
              quantity: 1,
              unit_price: Math.round(Number(numericAmount) * 100) / 100,
              currency_id: 'ARS' as const,
            },
          ];

      const totalAmount = saneItems.reduce(
        (acc: number, it: { unit_price: number; quantity: number }) => acc + Number(it.unit_price) * Number(it.quantity || 1),
        0,
      );

      // ---- back_urls en HTTP local (sin auto_return)
      const baseFront = ensureHttpUrl(process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
      const provided = (back_urls && typeof back_urls === 'object') ? back_urls : {};
      const success = ensureHttpUrl(provided.success || `${baseFront}/pago/success`) + `?orderId=${encodeURIComponent(orderId ?? '')}`;
      const failure = ensureHttpUrl(provided.failure || `${baseFront}/pago/failure`) + `?orderId=${encodeURIComponent(orderId ?? '')}`;
      const pending = ensureHttpUrl(provided.pending || `${baseFront}/pago/pending`) + `?orderId=${encodeURIComponent(orderId ?? '')}`;
      const backUrls = { success, failure, pending };

      // ---- Crear preferencia
      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);
      const mpPref: any = await preference.create({
        body: {
          items: saneItems.map((it: any, i: number) => ({ id: String(i + 1), ...it })),
          external_reference: orderId ? String(orderId) : undefined,
          back_urls: backUrls,
          // auto_return: 'approved',  // activalo si servís el front por HTTPS
        },
      });

      // ---- Persistencia best-effort (no romper si falla)
      let paymentId: number | null = null;
      try {
        const paymentUID = resolvePaymentUID(); // <- detecta el UID correcto
        if (paymentUID) {
          const orderPk =
            orderId !== undefined && orderId !== null && orderId !== '' && !Number.isNaN(Number(orderId))
              ? Number(orderId)
              : null;

          const created = await strapi.entityService.create(paymentUID, {
            data: {
              order: orderPk,
              status: 'init',
              amount: totalAmount,
              currency_id: saneItems[0]?.currency_id ?? 'ARS',
              external_reference: orderId ? String(orderId) : undefined,
              mp_preference_id: mpPref?.id,
              init_point: mpPref?.init_point,
              sandbox_init_point: mpPref?.sandbox_init_point,
              raw_preference: mpPref,
            },
          });

          paymentId = (created && typeof created === 'object' && 'id' in created) ? (created as any).id : null;
        } else {
          strapi?.log?.warn?.('[payments] No se encontró CT payment ni payments — salto persistencia');
        }
      } catch (persistErr: any) {
        strapi?.log?.warn?.('[payments] Persistencia fallida (continuo): ' + (persistErr?.message || persistErr));
      }

      ctx.body = {
        ok: true,
        preference_id: mpPref?.id,
        init_point: mpPref?.init_point,
        sandbox_init_point: mpPref?.sandbox_init_point,
        payment_id: paymentId,
      };
    } catch (e: any) {
      strapi?.log?.error?.('createPreference ERROR ->', e?.response?.data || e?.message);
      ctx.status = 500;
      ctx.body = { ok: false, error: e?.response?.data ?? e?.message ?? 'Error creando preferencia' };
    }
  },

  async cardPay(ctx: any) {
    try {
      const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, description, orderId } =
        ctx.request.body || {};

      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) { ctx.status = 500; ctx.body = { error: 'Falta MP_ACCESS_TOKEN' }; return; }

      if (!token) { ctx.status = 400; ctx.body = { error: 'Falta token' }; return; }
      const amount = Number(transaction_amount);
      if (!amount || Number.isNaN(amount)) { ctx.status = 400; ctx.body = { error: 'Monto inválido' }; return; }
      const email = payer?.email;
      if (!email) { ctx.status = 400; ctx.body = { error: 'Falta payer.email' }; return; }

      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);

      const mpRes: any = await payment.create({
        body: {
          transaction_amount: amount,
          token,
          description: description || 'Pago con tarjeta',
          installments: Number(installments || 1),
          payment_method_id,
          issuer_id,
          capture: true,
          external_reference: String(orderId || ''),
          payer: { email, identification: payer?.identification },
        },
      });

      ctx.body = { id: mpRes?.id, status: mpRes?.status, status_detail: mpRes?.status_detail };
    } catch (e: any) {
      strapi?.log?.error?.('cardPay ERROR ->', e?.response?.data || e?.message);
      ctx.status = 500;
      ctx.body = { error: e?.message || 'Error procesando pago', details: e?.response?.data ?? null };
    }
  },

// Confirmar pago al volver del redirect (sin webhook)
async confirm(ctx: any) {
  try {
    const { preference_id, payment_id } = ctx.request.query || {};
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { ctx.status = 500; ctx.body = { ok:false, error:'Falta MP_ACCESS_TOKEN' }; return; }

    // 1) Obtener el pago o merchant_order y recuperar external_reference (== orderId)
    // Usamos SDK v2:
    const client = new MercadoPagoConfig({ accessToken });
    let orderId: string | number | null = null;
    let status: string | null = null;

    if (payment_id) {
      const p = new Payment(client);
      const r: any = await p.get({ id: String(payment_id) });
      orderId = r?.external_reference ?? r?.metadata?.order_id ?? null;
      status  = r?.status ?? null;
    }

    if (!orderId && preference_id) {
      // fallback: consultá la preferencia y su external_reference
      const pref = new Preference(client);
      const pr: any = await pref.get({ preferenceId: String(preference_id) });
      orderId = pr?.external_reference ?? null;
      // status lo podríamos buscar listando pagos por preference, pero no hace falta si llegó aquí desde "approved"
      status = status || 'approved';
    }

    if (!orderId) {
      ctx.status = 400;
      ctx.body = { ok:false, error:'No se pudo determinar orderId (external_reference)' };
      return;
    }

    // 2) Marcar el pedido como pagado en tu BD
    // ADAPTA estas líneas a tu esquema real.
    // Intento 1: campo booleano "paid"
    const PUID = 'api::pedido.pedido';
    try {
      await strapi.entityService.update(PUID, Number(orderId), {
        data: { paid: true, payment_status: status || 'approved' },
      });
    } catch {
      // Intento 2: campo "status"
      try {
        await strapi.entityService.update(PUID, Number(orderId), {
          data: { status: 'paid' },
        });
      } catch (e) {
        strapi?.log?.warn?.('[payments.confirm] no pude actualizar el pedido, adaptá los campos a tu esquema');
      }
    }

    ctx.body = { ok: true, orderId, status: status || 'approved' };
  } catch (e:any) {
    strapi?.log?.error?.('[payments.confirm] ', e?.response?.data || e?.message);
    ctx.status = 500;
    ctx.body = { ok:false, error: e?.message || 'Error confirmando pago' };
  }
},


};
