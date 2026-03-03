// backend/src/api/payments/controllers/payments.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
console.log('==> Payments Controller Loaded');

import dotenv from 'dotenv';

dotenv.config();

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { ensureHttpUrl, getFrontendUrl, getBackendUrl, isHttps } from '../../../config/urls';

const PRODUCTO_UID = 'api::producto.producto';
const EXPECTED_TOKEN_PREFIX = 'APP_USR';

/**
 * Obtiene MP_ACCESS_TOKEN desde la config global (config/server.ts → mercadopagoToken).
 * Strapi carga env() al arranque; método estable en Railway.
 */
function getMpAccessToken(strapi?: any): string | null {
  const raw = strapi?.config?.get?.('server.mercadopagoToken');
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Log de diagnóstico para Railway/consola cuando falta MP_ACCESS_TOKEN */
function logPaymentEnvDiagnostics(strapi: any): void {
  const log = strapi?.log?.warn ?? strapi?.log?.error ?? console.warn;
  const env = process.env;
  const mpToken = env.MP_ACCESS_TOKEN;
  const mpSet = mpToken != null && String(mpToken).trim().length > 0;
  const sampleVars = [
    'NODE_ENV',
    'HOST',
    'PORT',
    'PUBLIC_URL',
    'FRONTEND_URL',
    'MP_ACCESS_TOKEN',
    'MP_PUBLIC_KEY',
    'DATABASE_CLIENT',
  ] as const;
  const lines = [
    '[payments] MP_ACCESS_TOKEN está vacío o no definido.',
    '[payments] Diagnóstico env (solo nombres; valores no se muestran por seguridad):',
    ...sampleVars.map((key) => {
      const val = env[key];
      const set = val != null && String(val).trim().length > 0;
      const hint = set ? `definida (length=${String(val).length})` : 'no definida o vacía';
      return `  - ${key}: ${hint}`;
    }),
    '[payments] En Railway: Revisá Variables del servicio y asegurate de tener MP_ACCESS_TOKEN. Tras cambiar variables, redeploy o reinicio.',
  ];
  log(lines.join('\n'));
}

/** URL base para redirects de pago (Mercado Pago back_urls) */
function getPaymentStatusBaseUrl(): string {
  const url = process.env.PAYMENT_STATUS_URL || process.env.FRONTEND_URL || '';
  if (url) return ensureHttpUrl(url).replace(/\/*$/, '');
  return 'https://mozoqr.vercel.app';
}

/** back_urls al frontend: /payment-success y /payment-failure (auto_return approved) */
function buildPaymentStatusBackUrls(): { success: string; failure: string; pending: string } {
  const base = getPaymentStatusBaseUrl();
  const frontBase = process.env.FRONTEND_URL ? ensureHttpUrl(process.env.FRONTEND_URL).replace(/\/*$/, '') : base;
  return {
    success: `${frontBase}/payment-success`,
    failure: `${frontBase}/payment-failure`,
    pending: `${frontBase}/payment-success?status=pending`,
  };
}

function resolvePaymentUID(strapi: any): string | null {
  const uid1 = 'api::payment.payment';
  const uid2 = 'api::payments.payment';
  const has1 = !!(strapi?.contentTypes && strapi.contentTypes[uid1]);
  const has2 = !!(strapi?.contentTypes && strapi.contentTypes[uid2]);
  if (has1) return uid1;
  if (has2) return uid2;
  return null;
}

// Intenta marcar el pedido como "paid" con el campo que exista
async function markOrderPaid(strapi: any, orderPk: number) {
  const ORDER_UID = 'api::pedido.pedido';
  const tries = [
    { data: { order_status: 'paid' } },
    { data: { status: 'paid' } },
    { data: { estado: 'paid' } },
    { data: { paid: true } },
  ];
  for (const t of tries) {
    try {
      await strapi.entityService.update(ORDER_UID, orderPk, t as any);
      return true;
    } catch (_err) {
      /* sigue intentando */
    }
  }
  strapi?.log?.error?.(`[payments] No pude marcar pedido ${orderPk} como pagado. Ningún campo coincidió (order_status/status/estado/paid).`);
  return false;
}

// Busca el pedido por varios caminos
async function resolveOrderPk(strapi: any, ref: string | number | null) {
  if (ref == null) return null;
  const ORDER_UID = 'api::pedido.pedido';
  const refStr = String(ref).trim();
  // 1) id numérico
  if (/^\d+$/.test(refStr)) {
    try {
      const existing = await strapi.entityService.findOne(ORDER_UID, Number(refStr), { fields: ['id'] });
      if (existing?.id) return existing.id;
    } catch { }
  }
  // 2) documentId (Strapi v4 uid de documento)
  try {
    const byDocument = await strapi.db.query(ORDER_UID).findOne({
      where: { documentId: refStr },
      select: ['id'],
    });
    if (byDocument?.id) return byDocument.id;
  } catch { }
  return null;
}

function getRequestBaseBackUrl(ctx: any): string | null {
  const headers = ctx?.request?.headers || {};
  const rawProto =
    headers['x-forwarded-proto'] ||
    headers['x-forwarded-protocol'] ||
    (ctx?.request?.secure ? 'https' : null);
  const rawHost = headers['x-forwarded-host'] || headers['host'];
  if (!rawHost) return null;

  const proto = String(rawProto || 'http').split(',')[0].trim() || 'http';
  const host = String(rawHost).split(',')[0].trim();
  if (!host) return null;

  try {
    return ensureHttpUrl(`${proto}://${host}`).replace(/\/*$/, '');
  } catch {
    return null;
  }
}

// Construye back_urls que pasan por el backend y le envían también orderRef
function buildBackendBackUrls(
  orderId?: string | number | null,
  strapiConfig?: any,
  slug?: string | null,
  baseBackOverride?: string | null
) {
  const baseFront = getFrontendUrl().replace(/\/*$/, '');
  const baseBack = ensureHttpUrl(baseBackOverride || getBackendUrl(strapiConfig)).replace(/\/*$/, '');
  const encOrder = encodeURIComponent(orderId ?? '');
  const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';

  const successFront = `${baseFront}/pago/success?orderId=${encOrder}${slugParam}`;
  const failureFront = `${baseFront}/pago/failure?orderId=${encOrder}${slugParam}`;
  const pendingFront = `${baseFront}/pago/pending?orderId=${encOrder}${slugParam}`;

  const wrap = (destFront: string) =>
    // Agrego orderRef para fallback si MP no me da external_reference
    `${baseBack}/api/payments/confirm?redirect=${encodeURIComponent(destFront)}&orderRef=${encOrder}`;

  return {
    success: wrap(successFront),
    failure: wrap(failureFront),
    pending: wrap(pendingFront),
  };
}

export default {
  async ping(ctx: any) {
    ctx.body = { ok: true, msg: 'payments api up' };
  },

  async createPreference(ctx: any) {
    const strapi = ctx.strapi;

    try {
      const { items, cartItems, orderId, amount, slug } = ctx.request.body || {};

      // Prioridad: process.env en cada request (Railway inyecta vars en runtime).
      // Strapi config puede haberse cargado antes de que existan las variables.
      const fromEnv =
        process.env.MP_ACCESS_TOKEN ||
        process.env.MERCADOPAGO_ACCESS_TOKEN ||
        process.env.MERCADO_PAGO_ACCESS_TOKEN;
      let fromConfig: string | undefined;
      try {
        const serverConfig = strapi?.config?.get?.('server');
        fromConfig = (serverConfig && typeof serverConfig === 'object' && (serverConfig as any).mercadopagoToken) || strapi?.config?.get?.('server.mercadopagoToken');
      } catch (_) {
        fromConfig = undefined;
      }
      const tokenStr =
        (typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : null) ||
        (typeof fromConfig === 'string' && fromConfig.trim() ? fromConfig.trim() : null) ||
        null;

      strapi?.log?.info?.(
        '[payments] createPreference token: env=' + (fromEnv ? 'ok' : 'no') + ', config=' + (fromConfig ? 'ok' : 'no') + ', final=' + (tokenStr ? 'ok' : 'FALTA'),
      );
      if (!tokenStr) {
        strapi?.log?.warn?.('[payments] Ninguna fuente tiene token (config, MP_ACCESS_TOKEN, MERCADOPAGO_ACCESS_TOKEN).');
        logPaymentEnvDiagnostics(strapi);
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error:
            'Falta token de Mercado Pago. En Railway: Variables del servicio, agregá MP_ACCESS_TOKEN (o MERCADOPAGO_ACCESS_TOKEN). Redeploy después.',
        };
        return;
      }

      const accessTokenForSdk: string = tokenStr;
      const client = new MercadoPagoConfig({ accessToken: accessTokenForSdk });
      const preference = new Preference(client);
      let saneItems: Array<{ title: string; quantity: number; unit_price: number; currency_id: 'ARS' }>;
      let backUrls: { success: string; failure: string; pending: string };
      const requestBaseBack = getRequestBaseBackUrl(ctx);
      const configuredBaseBack = getBackendUrl(strapi?.config).replace(/\/*$/, '');
      const effectiveBaseBack =
        /localhost(?::\d+)?$/i.test(configuredBaseBack) || /\/\/localhost(?::\d+)?/i.test(configuredBaseBack)
          ? (requestBaseBack || configuredBaseBack)
          : configuredBaseBack;
      if (effectiveBaseBack !== configuredBaseBack) {
        strapi?.log?.warn?.(
          `[payments] Backend URL no configurada (era "${configuredBaseBack}"). Usando base del request "${effectiveBaseBack}" para back_urls.`,
        );
      }

      // ---- Flujo cartItems: precios REALES desde la base de datos (no confiar en el front)
      const hasCartItems = Array.isArray(cartItems) && cartItems.length > 0;
      if (hasCartItems) {
        const resolved: Array<{ title: string; quantity: number; unit_price: number }> = [];
        for (const row of cartItems) {
          const productId = row.id ?? row.productId ?? row.product_id;
          const quantity = Math.max(1, Math.floor(Number(row.quantity ?? row.qty ?? 1)));
          if (productId == null || productId === '') {
            ctx.status = 400;
            ctx.body = { ok: false, error: 'Cada ítem del carrito debe tener id de producto (id/productId).' };
            return;
          }
          let product: { name?: string; price?: number } | null = null;
          try {
            const id = typeof productId === 'number' ? productId : Number(productId);
            if (!Number.isNaN(id)) {
              product = await strapi.entityService.findOne(PRODUCTO_UID, id, { fields: ['name', 'price'] });
            }
            if (!product && typeof productId === 'string') {
              const byDoc = await strapi.db.query(PRODUCTO_UID).findOne({
                where: { documentId: productId },
                select: ['name', 'price'],
              });
              if (byDoc) product = byDoc;
            }
          } catch (_e) {
            /* product not found */
          }
          if (!product) {
            ctx.status = 404;
            ctx.body = { ok: false, error: `Producto no encontrado: ${productId}` };
            return;
          }
          const unitPrice = Number(product.price ?? 0);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            ctx.status = 400;
            ctx.body = { ok: false, error: `Producto sin precio válido: ${productId}` };
            return;
          }
          resolved.push({
            title: String(product.name ?? 'Producto'),
            quantity,
            unit_price: Math.round(unitPrice * 100) / 100,
          });
        }
        saneItems = resolved.map((r) => ({ ...r, currency_id: 'ARS' as const }));
        backUrls = buildPaymentStatusBackUrls();
      } else {
        // ---- Flujo legacy: items con precios o amount
        const hasItems = Array.isArray(items) && items.length > 0;
        const numericAmount = typeof amount === 'number' ? Number(amount) : Number.NaN;
        if (!hasItems && (!numericAmount || Number.isNaN(numericAmount))) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'Debés enviar cartItems, items o amount (> 0).' };
          return;
        }

        saneItems = hasItems
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

        backUrls = buildBackendBackUrls(orderId, strapi?.config, slug, effectiveBaseBack);
      }

      const totalAmount = saneItems.reduce(
        (acc: number, it: { unit_price: number; quantity: number }) => acc + Number(it.unit_price) * Number(it.quantity || 1),
        0,
      );

      // ---- Crear preferencia (client/preference ya creados arriba con accessToken validado)
      // external_reference debe ser el ID de la orden de Strapi (api::pedido.pedido) para que el webhook
      // de Mercado Pago pueda asociar el pago aprobado con la orden y marcarla como 'paid'.
      if (hasCartItems && (orderId === undefined || orderId === null || orderId === '')) {
        strapi?.log?.warn?.(
          '[payments.createPreference] cartItems sin orderId: el webhook no podrá marcar la orden como paid. Enviá orderId (ID del pedido creado en Strapi).',
        );
      }
      const baseBack = effectiveBaseBack;
      const body: any = {
        items: saneItems.map((it: any, i: number) => ({ id: String(i + 1), ...it })),
        external_reference: orderId != null && orderId !== '' ? String(orderId) : undefined,
        back_urls: backUrls,
        auto_return: 'approved' as const,
      };

      let mpPref: any;
      try {
        mpPref = await preference.create({ body });
      } catch (mpErr: any) {
        const mpResponse = mpErr?.response;
        const mpData = mpResponse?.data;
        // Log completo del error para diagnóstico (token, precio, items, etc.)
        console.error('[payments.createPreference] Mercado Pago API error (full object):', {
          message: mpErr?.message,
          name: mpErr?.name,
          status: mpResponse?.status,
          statusText: mpResponse?.statusText,
          data: mpData,
          config: mpErr?.config ? { url: mpErr.config?.url, method: mpErr.config?.method } : undefined,
        });
        if (mpData && typeof mpData === 'object') {
          console.error('[payments.createPreference] MP response.data (raw):', JSON.stringify(mpData, null, 2));
        }
        try {
          console.error('[payments.createPreference] Full error (serialized):', JSON.stringify(mpErr, Object.getOwnPropertyNames(mpErr), 2));
        } catch (_) {
          console.error('[payments.createPreference] Full error (toString):', String(mpErr));
        }
        strapi?.log?.error?.('[payments.createPreference] Mercado Pago API error:', {
          status: mpResponse?.status,
          statusText: mpResponse?.statusText,
          data: mpData,
          message: mpErr?.message,
        });
        if (mpData && typeof mpData === 'object') {
          strapi?.log?.error?.('[payments.createPreference] MP response.data (raw):', JSON.stringify(mpData));
        }
        throw mpErr;
      }

      // ---- Persistencia best-effort
      let paymentId: number | null = null;
      try {
        const paymentUID = resolvePaymentUID(strapi);
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
      const strapi = ctx.strapi;
      const mpData = e?.response?.data;
      const msg = e?.message ?? 'Error desconocido';
      const detail = mpData ? JSON.stringify(mpData) : msg;
      // Log completo del objeto de error para diagnóstico en Railway
      console.error('[payments.createPreference] 500 - error completo:', {
        message: e?.message,
        name: e?.name,
        status: e?.response?.status,
        data: e?.response?.data,
        stack: e?.stack,
      });
      try {
        console.error('[payments.createPreference] 500 - error (serialized):', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      } catch (_) {
        console.error('[payments.createPreference] 500 - error (toString):', String(e));
      }
      strapi?.log?.error?.('[payments.createPreference] 500 - detalle:', detail);
      if (e?.response) {
        strapi?.log?.error?.('[payments.createPreference] response.status:', e.response.status, 'response.data:', e.response.data);
      }
      if (e?.stack) strapi?.log?.error?.('[payments.createPreference] stack:', e.stack);
      ctx.status = 500;
      const clientError =
        (typeof mpData?.message === 'string' && mpData.message) ||
        (typeof mpData?.cause === 'string' && mpData.cause) ||
        msg;
      ctx.body = { ok: false, error: clientError };
    }
  },

  async cardPay(ctx: any) {
    try {
      const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, description, orderId } =
        ctx.request.body || {};

      const accessToken = getMpAccessToken(ctx.strapi);
      if (!accessToken) {
        logPaymentEnvDiagnostics(ctx.strapi);
        ctx.status = 500;
        ctx.body = { error: 'Falta MP_ACCESS_TOKEN. Revisá variables de entorno (Railway: Variables del servicio).' };
        return;
      }

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
      const strapi = ctx.strapi;
      strapi?.log?.error?.('cardPay ERROR ->', e?.response?.data || e?.message);
      ctx.status = 500;
      ctx.body = { error: e?.message || 'Error procesando pago', details: e?.response?.data ?? null };
    }
  },

  // Confirmar pago al volver del redirect (sin webhook)
  async confirm(ctx: any) {
    try {
      const strapi = ctx.strapi;
      const q = ctx.request.query || {};
      const paymentIdQ = q.payment_id ?? q.collection_id;
      const preferenceIdQ = q.preference_id ?? q.preference_id;
      const statusQ = (q.status ?? q.collection_status ?? '').toString().toLowerCase() || null;
      const orderRefQ = (q.orderRef ?? '').toString() || null; // <- fallback extra que nosotros pasamos

      const accessToken = getMpAccessToken(strapi);
      if (!accessToken) {
        logPaymentEnvDiagnostics(strapi);
        ctx.status = 500;
        ctx.body = { ok: false, error: 'Falta MP_ACCESS_TOKEN. Revisá variables de entorno (Railway: Variables del servicio).' };
        return;
      }

      const client = new MercadoPagoConfig({ accessToken });
      let orderRef: string | number | null = orderRefQ; // start with our own hint
      let status: string | null = statusQ;
      let rawPayment: any = null;

      // 1) Si hay payment_id/collection_id, consulto Payment API
      if (paymentIdQ) {
        try {
          const payment = new Payment(client);
          const mpPayment: any = await payment.get({ id: String(paymentIdQ) });
          rawPayment = mpPayment;
          // si MP trae external_reference, pisa nuestro hint
          orderRef = mpPayment?.external_reference ?? mpPayment?.metadata?.order_id ?? orderRef;
          status = (mpPayment?.status ?? status)?.toLowerCase() || null;
        } catch (err: any) {
          strapi?.log?.warn?.(`[payments.confirm] No pude obtener payment ${paymentIdQ}: ${err?.message}`);
        }
      }

      // 2) Fallback por preference_id si aún no tengo orderRef
      if (!orderRef && preferenceIdQ) {
        try {
          const preference = new Preference(client);
          const mpPref: any = await preference.get({ preferenceId: String(preferenceIdQ) });
          orderRef = mpPref?.external_reference ?? null;
          status = status || 'approved';
        } catch (err: any) {
          strapi?.log?.warn?.(`[payments.confirm] No pude obtener preference ${preferenceIdQ}: ${err?.message}`);
        }
      }

      if (!orderRef) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'No se pudo determinar orderId (external_reference/orderRef)' };
        return;
      }

      // 3) Resolver PK del pedido con múltiples estrategias
      const orderPk = await resolveOrderPk(strapi, orderRef);
      if (!orderPk) {
        ctx.status = 404;
        ctx.body = { ok: false, error: `Pedido no encontrado para ref: ${orderRef}` };
        return;
      }

      // 4) Marcar como paid si corresponde
      const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
      const shouldMarkPaid = normalizedStatus === 'approved';
      if (shouldMarkPaid) await markOrderPaid(strapi, orderPk);
      else strapi?.log?.info?.(`[payments.confirm] Estado no aprobado (${normalizedStatus}). No marco paid.`);

      // 5) Actualizar registro de payments si existe
      const paymentUID = resolvePaymentUID(strapi);
      if (paymentUID) {
        try {
          const searchFilters: Record<string, any> = { order: orderPk };
          if (preferenceIdQ) searchFilters.mp_preference_id = String(preferenceIdQ);

          const existing = await strapi.entityService.findMany(paymentUID, { filters: searchFilters, limit: 1 });
          if (existing && existing.length > 0) {
            const data: Record<string, any> = {};
            if (normalizedStatus) data.status = normalizedStatus;
            if (paymentIdQ) data.mp_payment_id = String(paymentIdQ);
            if (shouldMarkPaid) data.paid_at = new Date();
            if (rawPayment) data.raw_payment = rawPayment;
            if (Object.keys(data).length > 0) await strapi.entityService.update(paymentUID, existing[0].id, { data });
          }
        } catch (err) {
          strapi?.log?.debug?.(`[payments.confirm] No se pudo actualizar registro de pago: ${err?.message || err}`);
        }
      }

      // 6) Redirección al front si vino "redirect"
      const redirect = (ctx.request.query?.redirect as string) || null;
      if (redirect) {
        const dest = ensureHttpUrl(redirect);
        ctx.status = 302;
        ctx.redirect(dest);
        return;
      }

      ctx.body = { ok: true, orderId: orderPk, status: normalizedStatus || status || 'approved' };
    } catch (e: any) {
      const strapi = ctx.strapi;
      strapi?.log?.error?.('[payments.confirm] ', e?.response?.data || e?.message);
      ctx.status = 500;
      ctx.body = { ok: false, error: e?.message || 'Error confirmando pago' };
    }
  },

  /**
   * POST /restaurants/:slug/payments
   * Mock/Manual payment creation
   */
  async create(ctx: any) {
    const strapi = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const payload = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const { orderId, status, amount, provider, externalRef } = payload;

    if (!orderId) return ctx.badRequest('Falta orderId');

    // 1) Verificar que el pedido exista y pertenezca al restaurante
    const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
      fields: ['id', 'order_status', 'total'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.id) return ctx.notFound('Pedido no encontrado');

    const orderRestId = order.restaurante?.id || order.restaurante;
    if (String(orderRestId) !== String(restauranteId)) {
      return ctx.unauthorized('Pedido de otro restaurante');
    }

    // 2) Recalcular subtotal en servidor
    let serverSubtotal = 0;
    try {
      const itemsA = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
        filters: { pedido: order.id },
        fields: ['qty', 'price'],
        limit: 500,
      });
      if (Array.isArray(itemsA) && itemsA.length) {
        serverSubtotal = itemsA.reduce((s: number, it: any) => {
          const q = Number(it?.qty || 0);
          const p = Number(it?.price || 0);
          const line = q * p;
          return s + (Number.isFinite(line) ? line : 0);
        }, 0);
      }
    } catch (e) {
      strapi.log.debug('No se pudo leer item-pedido, se usa order.total como fallback');
    }

    if (!Number.isFinite(serverSubtotal) || serverSubtotal <= 0) {
      serverSubtotal = Number(order.total || 0) || 0;
    }

    // 3) Validar amount
    if (amount !== undefined && amount !== null) {
      const cents = (n: any) => Math.round(Number(n) * 100);
      if (cents(amount) !== cents(serverSubtotal)) {
        return ctx.badRequest('El monto no coincide con el subtotal del servidor');
      }
    }

    // 4) Datos a guardar
    const data = {
      status: status || 'approved',
      amount: amount ?? serverSubtotal,
      provider: provider || 'mock',
      externalRef: externalRef || null,
      order: order.id,
      restaurante: restauranteId,
    };

    // 5) Crear Payment
    try {
      await strapi.entityService.create('api::payments.payments', { data });
    } catch (e1) {
      try {
        await strapi.entityService.create('api::payment.payment', { data });
      } catch (e2) {
        strapi.log.warn('Payment CT missing. Continuing without persisting payment record.');
      }
    }

    // 6) Si aprobado, marcar pedido como paid
    if (String(status || 'approved').toLowerCase() === 'approved') {
      await strapi.entityService.update('api::pedido.pedido', order.id, {
        data: { order_status: 'paid' },
      });
    }

    ctx.body = { data: { ok: true } };
  },
};

