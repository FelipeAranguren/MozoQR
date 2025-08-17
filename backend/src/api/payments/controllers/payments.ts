/* eslint-disable @typescript-eslint/no-explicit-any */
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

declare const strapi: any;

export default {
  // ——— opcional: si ya lo tenés, podés dejarlo tal cual ———
  async createPreference(ctx: any) {
    try {
      const { items, orderId } = ctx.request.body || {};
      if (!process.env.MP_ACCESS_TOKEN) {
        ctx.status = 500; ctx.body = { error: 'Falta MP_ACCESS_TOKEN' }; return;
      }
      if (!Array.isArray(items) || items.length === 0) {
        ctx.status = 400; ctx.body = { error: 'Items requeridos' }; return;
      }

      const saneItems = items.map((it: any) => {
        const quantity = Number(it.quantity ?? it.qty ?? 1);
        const unit_price = Number(it.unit_price ?? it.price ?? it.precio ?? 0);
        const title = String(it.title ?? it.nombre ?? 'Pedido');
        if (!quantity || !unit_price || Number.isNaN(quantity) || Number.isNaN(unit_price)) {
          throw new Error('quantity/unit_price inválidos (>0)');
        }
        return { title, quantity, unit_price, currency_id: 'ARS' as const };
      });

      const baseFront = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
      const successUrl = new URL('/pago/success', baseFront).toString();
      const failureUrl = new URL('/pago/failure', baseFront).toString();
      const pendingUrl = new URL('/pago/pending', baseFront).toString();

      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN as string });
      const preference = new Preference(client);

      const body: any = {
        items: saneItems,
        external_reference: String(orderId || ''),
        back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
        auto_return: 'approved',
      };

      const mpPref: any = await preference.create({ body });
      ctx.body = { init_point: mpPref?.init_point, id: mpPref?.id };
    } catch (e: any) {
      strapi?.log?.error?.('createPreference ERROR ->', { message: e?.message, response: e?.response?.data });
      ctx.status = 500; ctx.body = { error: e?.message || 'Error creando preferencia' };
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
