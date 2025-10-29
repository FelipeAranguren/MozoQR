/* eslint-disable @typescript-eslint/no-explicit-any */
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

declare const strapi: any;

export default {
  // ——— opcional: si ya lo tenés, podés dejarlo tal cual ———
  async createPreference(ctx: any) {
    try {
      const { items, orderId, amount, payer_email, back_urls } = ctx.request.body || {};
      const orderPk = orderId !== undefined && orderId !== null && orderId !== '' && !Number.isNaN(Number(orderId))
        ? Number(orderId)
        : null;
      const accessToken = process.env.MP_ACCESS_TOKEN;

      if (!accessToken) {
        ctx.status = 500;
        ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
        return;
      }
      const hasItems = Array.isArray(items) && items.length > 0;
      const numericAmount = typeof amount === 'number' ? Number(amount) : Number.NaN;

      if (!hasItems && (!numericAmount || Number.isNaN(numericAmount))) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Debés enviar items o amount válido (> 0).' };
        return;
      }

      const normalizedAmount = !hasItems ? Math.round(numericAmount * 100) / 100 : null;

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
              unit_price: Number.isFinite(normalizedAmount) ? normalizedAmount : Number(numericAmount),
              currency_id: 'ARS' as const,
            },
          ];

      const totalAmount = saneItems.reduce(
        (acc: number, it: { unit_price: number; quantity: number }) => acc + Number(it.unit_price) * Number(it.quantity || 1),
        0,
      );

      if (!totalAmount || Number.isNaN(totalAmount)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Monto inválido para la preferencia.' };
        return;
      }

      const baseFront = (process.env.FRONTEND_URL || 'http://127.0.0.1:5173').trim();
      const defaultSuccess = new URL('/pago/success', baseFront).toString();
      const defaultFailure = new URL('/pago/failure', baseFront).toString();
      const defaultPending = new URL('/pago/pending', baseFront).toString();
      const providedBackUrls = back_urls && typeof back_urls === 'object' ? back_urls : {};
      const backUrls = {
        success: providedBackUrls.success || defaultSuccess,
        failure: providedBackUrls.failure || defaultFailure,
        pending: providedBackUrls.pending || defaultPending,
      };

      const backendBase = (process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:1337').replace(/\/+$/, '');

      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      const body: any = {
        items: saneItems,
        external_reference: orderId ? String(orderId) : undefined,
        back_urls: backUrls,
        auto_return: 'approved',
        notification_url: `${backendBase}/api/mercadopago/webhook`,
      };

      if (payer_email) {
        body.payer = { email: String(payer_email) };
      }

      const mpPref: any = await preference.create({ body });
      
      const paymentRecord = await strapi.entityService.create('api::payment.payment', {
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

      ctx.body = {
        ok: true,
        preference_id: mpPref?.id,
        init_point: mpPref?.init_point,
        sandbox_init_point: mpPref?.sandbox_init_point,
        payment_id: paymentRecord?.id,
      };

    } catch (e: any) {
      strapi?.log?.error?.('createPreference ERROR ->', { message: e?.message, response: e?.response?.data });
      ctx.status = 500;
      ctx.body = { ok: false, error: e?.message || 'Error creando preferencia' };
    }
  },

  // ——— NUEVO: pago con tarjeta (Card Payment Brick) ———
  async cardPay(ctx: any) {
    try {
      const {
        token,                // token de la tarjeta (lo manda el Brick)
        issuer_id,            // opcional
        payment_method_id,    // ej. 'visa'
        transaction_amount,   // monto total (number)
        installments,         // cuotas (number)
        payer,                // { email, identification? }
        description,          // ej. 'Pedido...'
        orderId,              // tu referencia
      } = ctx.request.body || {};

      if (!process.env.MP_ACCESS_TOKEN) {
        ctx.status = 500; ctx.body = { error: 'Falta MP_ACCESS_TOKEN' }; return;
      }
      // Validaciones mínimas
      if (!token) { ctx.status = 400; ctx.body = { error: 'Falta token' }; return; }
      const amount = Number(transaction_amount);
      if (!amount || Number.isNaN(amount)) { ctx.status = 400; ctx.body = { error: 'Monto inválido' }; return; }
      const email = payer?.email;
      if (!email) { ctx.status = 400; ctx.body = { error: 'Falta payer.email' }; return; }

      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN as string });
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
          payer: {
            email,
            identification: payer?.identification, // opcional { type, number }
          },
        },
      });

      ctx.body = {
        id: mpRes?.id,
        status: mpRes?.status,               // approved | in_process | rejected
        status_detail: mpRes?.status_detail,
      };
    } catch (e: any) {
      strapi?.log?.error?.('cardPay ERROR ->', { message: e?.message, response: e?.response?.data });
      ctx.status = 500;
      ctx.body = { error: e?.message || 'Error procesando pago', details: e?.response?.data ?? null };
    }
  },
};
