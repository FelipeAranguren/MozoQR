// backend/src/api/mobbex/controllers/mobbex.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getBackendUrl, getFrontendUrl } from '../../../config/urls';

type MobbexCheckoutBody = {
  total: number;
  currency?: string;
  reference: string;
  description?: string;
  test: boolean;
  redirectUrl?: string;
  webhook?: string;
  installments?: number;
  source?: {
    type?: string;
    origin?: string;
  };
  custom?: Record<string, unknown>;
};

function getMobbexConfig() {
  const apiKey = process.env.MOBBEX_API_KEY;
  const accessToken = process.env.MOBBEX_ACCESS_TOKEN;

  if (!apiKey || !accessToken) {
    throw new Error(`[mobbex] API_KEY: ${apiKey ? 'SI' : 'NO'}, TOKEN: ${accessToken ? 'SI' : 'NO'}`);
}

  const testFlag = String(process.env.MOBBEX_TEST_MODE ?? 'true').toLowerCase() === 'true';

  return { apiKey, accessToken, testFlag };
}

async function callMobbexCheckout(body: MobbexCheckoutBody) {
  const { apiKey, accessToken } = getMobbexConfig();

  // 1. Log de inicio y verificación de presencia de llaves
  console.log("--- INICIANDO LLAMADA A MOBBEX ---");
  console.log("API Key cargada:", !!apiKey);
  console.log("Token cargado:", !!accessToken);

  // 2. Log del OBJETO que le enviamos a Mobbex (aquí suele estar el error)
  console.log("Body enviado a Mobbex:", JSON.stringify(body, null, 2));

  try {
    const res = await fetch('https://api.mobbex.com/p/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'x-access-token': accessToken.trim(),
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;

    // 3. Log de la RESPUESTA de Mobbex si algo falla
    if (!res.ok) {
      console.error("❌ ERROR DESDE LA API DE MOBBEX:");
      console.error("Status:", res.status);
      console.error("Respuesta completa de Mobbex:", JSON.stringify(data, null, 2));
      console.log("----------------------------------");

      const msg = (data && (data.error || data.message || data.detail)) || `Mobbex error HTTP ${res.status}`;
      const error = new Error(String(msg));
      (error as any).response = data;
      throw error;
    }

    // 4. Log en caso de éxito
    console.log("✅ CHECKOUT CREADO CON ÉXITO");
    console.log("URL generada:", data?.data?.url);
    console.log("----------------------------------");

    return data;
  } catch (err: any) {
    console.error("❌ ERROR CRÍTICO EN callMobbexCheckout:", err.message);
    throw err;
  }
}

export default {
  /**
   * Crea un checkout de Mobbex y devuelve la URL a la que debe redirigir el frontend.
   *
   * Espera en el body:
   * - total: number (requerido)
   * - reference: string | number (requerido, id/documentId del pedido o combinación slug+mesa)
   * - cardType: 'credit' | 'debit' (opcional, solo informativo)
   * - cardBrand: 'visa' | 'mastercard' (opcional, solo informativo)
   * - slug, table, tableSessionId (opcionales, se guardan como metadata/custom)
   */
  async createCheckout(ctx: any) {
    const strapi = ctx.strapi;

    try {
      const {
        total,
        reference,
        cardType,
        cardBrand,
        slug,
        table,
        tableSessionId,
      } = ctx.request.body || {};

      const amount = Number(total);
      if (!Number.isFinite(amount) || amount <= 0) {
        ctx.status = 400;
        ctx.body = {
          ok: false,
          error: 'El total del checkout es inválido o no fue enviado.',
        };
        return;
      }

      if (reference == null || String(reference).trim() === '') {
        ctx.status = 400;
        ctx.body = {
          ok: false,
          error: 'La referencia del pedido es obligatoria para generar el checkout.',
        };
        return;
      }

      const { testFlag } = getMobbexConfig();

      const frontBase = getFrontendUrl().replace(/\/*$/, '');
      const backBase = getBackendUrl(strapi?.config).replace(/\/*$/, '');
      const refStr = String(reference).trim();

      const redirectUrl = `${frontBase}/payment-success?provider=mobbex&ref=${encodeURIComponent(
        refStr
      )}`;
      const webhookUrl = `${backBase}/api/mobbex/webhook`;

      const body: MobbexCheckoutBody = {
        total: amount,
        currency: 'ARS',
        reference: refStr,
        description: `Pago pedido ${refStr}`,
        test: true, // Siempre true en sandbox (además de MOBBEX_TEST_MODE)
        redirectUrl,
        webhook: webhookUrl,
        source: {
          type: 'website',
          origin: frontBase,
        },
        custom: {
          cardType: cardType || null,
          cardBrand: cardBrand || null,
          slug: slug || null,
          table: table || null,
          tableSessionId: tableSessionId || null,
          testFlag,
        },
      };

      const response = await callMobbexCheckout(body);

      const checkoutUrl =
        response?.data?.url ||
        response?.url ||
        response?.result?.data?.url ||
        null;

      if (!checkoutUrl) {
        strapi?.log?.error?.(
          `[mobbex] Respuesta sin URL de checkout: ${JSON.stringify(response)}`
        );
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error:
            'No se recibió una URL de pago de Mobbex. Revisá las credenciales o intentá de nuevo.',
        };
        return;
      }

      ctx.status = 200;
      ctx.body = {
        ok: true,
        checkoutUrl,
        raw: response,
      };
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.toString?.() ||
        'Error desconocido al crear el checkout de Mobbex.';

      strapi?.log?.error?.('[mobbex] Error en createCheckout: ' + msg, err);

      ctx.status = 500;
      ctx.body = {
        ok: false,
        error: msg,
      };
    }
  },

  /**
   * Webhook de Mobbex.
   *
   * Por ahora solo registra la notificación y devuelve 200 para confirmar recepción.
   * Más adelante se puede integrar con la lógica de pedidos (marcar como pagado usando `reference`).
   */
  async webhook(ctx: any) {
    const strapi = ctx.strapi;

    try {
      const payload = ctx.request.body || {};

      strapi?.log?.info?.('[mobbex] Webhook recibido: ' + JSON.stringify(payload));

      // TODO: si querés, acá podés:
      // - Leer payload.data.reference o similar
      // - Buscar el pedido en Strapi
      // - Marcarlo como pagado

      ctx.status = 200;
      ctx.body = { ok: true };
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.toString?.() ||
        'Error desconocido al procesar webhook de Mobbex.';

      strapi?.log?.error?.('[mobbex] Error en webhook: ' + msg, err);

      // Igual respondemos 200 para que Mobbex no siga reintentando indefinidamente,
      // pero incluimos ok:false para diagnóstico si lo consultás desde logs.
      ctx.status = 200;
      ctx.body = {
        ok: false,
        error: msg,
      };
    }
  },
};

