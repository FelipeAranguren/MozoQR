import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

function getMpAccessTokenEnv(): string | null {
  const raw = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Tokens: .env global + todos los MetodosPago mercado_pago activos. */
export async function collectMercadoPagoTokens(strapi: any): Promise<string[]> {
  const tokens: string[] = [];
  const env = getMpAccessTokenEnv();
  if (env) tokens.push(env);

  try {
    const rows = await strapi.entityService.findMany('api::metodos-pago.metodos-pago', {
      filters: { provider: 'mercado_pago', active: true },
      fields: ['mp_access_token'],
      limit: 200,
    });
    for (const r of rows || []) {
      const t = String((r as any)?.mp_access_token || '').trim();
      if (t && !tokens.includes(t)) tokens.push(t);
    }
  } catch {
    /* ignore */
  }
  return tokens;
}

/**
 * Obtiene un pago de Mercado Pago probando el token global (.env) y luego todos los
 * mp_access_token de MetodosPago activos.
 */
export async function fetchMpPaymentWithAnyToken(
  strapi: any,
  paymentId: string,
): Promise<{ payment: any; tokenUsed: string } | null> {
  const tokens = await collectMercadoPagoTokens(strapi);

  for (const accessToken of tokens) {
    try {
      const client = new MercadoPagoConfig({ accessToken });
      const paymentApi = new Payment(client);
      const mpPayment: any = await paymentApi.get({ id: String(paymentId) });
      if (mpPayment?.id != null) return { payment: mpPayment, tokenUsed: accessToken };
    } catch {
      /* siguiente token */
    }
  }
  return null;
}

/** Preference (external_reference del pedido). */
export async function fetchMpPreferenceWithAnyToken(
  strapi: any,
  preferenceId: string,
): Promise<{ preference: any; tokenUsed: string } | null> {
  const tokens = await collectMercadoPagoTokens(strapi);

  for (const accessToken of tokens) {
    try {
      const client = new MercadoPagoConfig({ accessToken });
      const preferenceApi = new Preference(client);
      const pref: any = await preferenceApi.get({ preferenceId: String(preferenceId) });
      if (pref?.id != null) return { preference: pref, tokenUsed: accessToken };
    } catch {
      /* siguiente token */
    }
  }
  return null;
}

/** Merchant order (notificaciones tipo merchant_order). */
export async function fetchMerchantOrderWithAnyToken(
  strapi: any,
  merchantOrderId: string,
): Promise<{ merchantOrder: any; tokenUsed: string } | null> {
  const tokens = await collectMercadoPagoTokens(strapi);

  for (const accessToken of tokens) {
    try {
      const res = await fetch(`https://api.mercadopago.com/merchant_orders/${merchantOrderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) continue;
      const mo = await res.json();
      if (mo?.id != null) return { merchantOrder: mo, tokenUsed: accessToken };
    } catch {
      /* siguiente token */
    }
  }
  return null;
}
