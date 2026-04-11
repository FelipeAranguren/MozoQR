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
    throw new Error(`[mobbex] Faltan credenciales. API_KEY: ${apiKey ? 'SI' : 'NO'}, TOKEN: ${accessToken ? 'SI' : 'NO'}`);
  }

  const testFlag = String(process.env.MOBBEX_TEST_MODE ?? 'true').toLowerCase() === 'true';
  return { apiKey, accessToken, testFlag };
}

async function callMobbexCheckout(body: MobbexCheckoutBody) {
  const { apiKey, accessToken } = getMobbexConfig();

  console.log("--- LLAMANDO A API DE MOBBEX ---");
  
  try {
    // Usamos la URL de producción ahora que las keys están limpias
    const res = await fetch('https://api.mobbex.com/p/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'x-access-token': accessToken.trim(),
        // Añadimos un User-Agent para que el servidor de Mobbex no nos rechace
        'User-Agent': 'MozoQR-App' 
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Respuesta Mobbex Error:", data);
      throw new Error(data.error || "Error de Mobbex");
    }

    console.log("✅ CHECKOUT CREADO");
    return data;
  } catch (error: any) {
    console.error("❌ ERROR DE CONEXIÓN:", error.message);
    // Si sigue saliendo 'fetch failed', es un tema de red de Railway
    throw new Error("Error al conectar con la pasarela de pagos. Reintente.");
  }
}

export default {
  async createCheckout(ctx: any) {
    const strapi = ctx.strapi;
  
    try {
      // Capturamos los datos y ponemos valores por defecto para que no explote
      const { total, reference, slug, table } = ctx.request.body || {};
  
      console.log("--- INICIANDO PROCESO DE CHECKOUT ---");
      console.log("Datos recibidos:", { total, reference, slug });
  
      if (!total || !reference) {
        ctx.status = 400;
        ctx.body = { ok: false, error: "Faltan datos: total y referencia son obligatorios." };
        return;
      }
  
      const body = {
        total: Number(total),
        currency: 'ARS',
        reference: String(reference),
        description: `Pago mesa ${table || '0'} - ${slug || 'MozoQR'}`,
        test: true, // Esto habilita el modo de prueba
        return_url: "https://mozoqr.vercel.app/payment-success", // Pon tu URL real
        webhook: "https://mozoqr-production.up.railway.app/api/mobbex/webhook"
      };
  
      const response = await callMobbexCheckout(body);
      
      // Si llegamos acá, Mobbex nos dio la URL
      ctx.status = 200;
      ctx.body = {
        ok: true,
        checkoutUrl: response?.data?.url || response?.url
      };
  
    } catch (err: any) {
      console.error("❌ ERROR EN CONTROLADOR:", err.message);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },
  async webhook(ctx: any) {
    const strapi = ctx.strapi;
    try {
      const payload = ctx.request.body || {};
      strapi?.log?.info?.('[mobbex] Webhook: ' + JSON.stringify(payload));
      ctx.status = 200;
      ctx.body = { ok: true };
    } catch (err: any) {
      ctx.status = 200; // Siempre 200 para Mobbex
      ctx.body = { ok: false, error: err.message };
    }
  },
};