// backend/src/api/payments/controllers/payments.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
console.log('==> Payments Controller Loaded');

import dotenv from 'dotenv';

dotenv.config();

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { ensureHttpUrl, getFrontendUrl, getBackendUrl, isHttps } from '../../../config/urls';
import { fetchMpPaymentWithAnyToken, fetchMpPreferenceWithAnyToken } from '../../../utils/mpPaymentFetch';
import { notifyPagoMercadoPagoForOrder } from '../../notificaciones/services/pagosNotifier';

const PRODUCTO_UID = 'api::producto.producto';
const RESTAURANTE_UID = 'api::restaurante.restaurante';
const METODOS_PAGO_UID = 'api::metodos-pago.metodos-pago';
const ORDER_UID = 'api::pedido.pedido';

/** Obtiene la instancia de Strapi (ctx.strapi o fallback global para rutas custom). */
function getStrapi(ctx: any): any {
  return ctx?.strapi ?? (typeof global !== 'undefined' && (global as any).__STRAPI__) ?? null;
}

/**
 * Misma lógica que el frontend: encuentra el método con provider === 'mercado_pago' y active === true.
 * Comparación estricta: provider debe ser exactamente 'mercado_pago' (snake_case); active booleano true (o 1 en BD).
 */
function findMercadoPagoActivo(rows: any[]): any {
  const list = Array.isArray(rows) ? rows : [];
  return list.find((r: any) => {
    const provider = r?.provider;
    const active = r?.active;
    const providerOk = provider === 'mercado_pago';
    const activeOk = active === true || active === 1;
    return providerOk && activeOk;
  }) ?? null;
}

/**
 * Obtiene el access_token de Mercado Pago del restaurante desde MetodosPago.
 * Solo uso server-side; nunca exponer mp_access_token al cliente.
 */
async function getMpAccessTokenForRestaurant(strapi: any, restauranteId: number): Promise<string | null> {
  if (!restauranteId || !strapi?.entityService) return null;
  try {
    const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
      filters: { restaurante: restauranteId },
      limit: 50,
    });
    const first = findMercadoPagoActivo(rows);
    if (!first?.mp_access_token) return null;
    const token = String(first.mp_access_token).trim();
    return token.length > 0 ? token : null;
  } catch (_e) {
    return null;
  }
}

/** Resuelve el ID del restaurante por slug. */
async function getRestauranteIdBySlug(strapi: any, slug: string): Promise<number | null> {
  if (!slug || typeof slug !== 'string' || !strapi?.db) return null;
  try {
    const row = await strapi.db.query(RESTAURANTE_UID).findOne({
      where: { slug: slug.trim() },
      select: ['id'],
    });
    return row?.id != null ? Number(row.id) : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Obtiene el access_token de Mercado Pago del restaurante cuyo nombre es exactamente 'Personal'.
 * Busca en MetodosPago filtrando por restaurante.name = 'Personal' y provider=mercado_pago, active=true.
 * (El schema de Restaurante usa el atributo "name", no "nombre".)
 */
async function getMpAccessTokenForRestaurantByName(
  strapi: any,
  restaurantName: string
): Promise<string | null> {
  if (!restaurantName || typeof restaurantName !== 'string' || !strapi?.entityService) return null;
  try {
    const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
      filters: {
        restaurante: {
          name: { $eq: restaurantName.trim() },
        },
      },
      limit: 20,
    });
    const first = findMercadoPagoActivo(Array.isArray(rows) ? rows : []);
    if (!first?.mp_access_token) return null;
    const token = String(first.mp_access_token).trim();
    return token.length > 0 ? token : null;
  } catch (_e) {
    return null;
  }
}

/** documentId del restaurante 'Personal' para suscripciones (fallback si la búsqueda por name falla). */
const PERSONAL_RESTAURANT_DOCUMENT_ID = 'a89pkyzu88uy8zwhqwl4zseu';

/**
 * Obtiene el access_token de MP del restaurante identificado por documentId (ej. Personal).
 */
async function getMpAccessTokenForRestaurantByDocumentId(
  strapi: any,
  documentId: string
): Promise<string | null> {
  if (!documentId || typeof documentId !== 'string' || !strapi?.db) return null;
  try {
    const restaurante = await strapi.db.query(RESTAURANTE_UID).findOne({
      where: { documentId: documentId.trim() },
      select: ['id'],
    });
    const restauranteId = restaurante?.id != null ? Number(restaurante.id) : null;
    if (restauranteId == null) return null;
    return getMpAccessTokenForRestaurant(strapi, restauranteId);
  } catch (_e) {
    return null;
  }
}

/** Precios de planes en USD (origen único; no confiar en el frontend).
 * Para pruebas, el plan básico queda casi gratis (0.0007 USD ≈ 1 ARS).
 */
const SUBSCRIPTION_PLAN_USD: Record<string, number> = {
  basico: 0.0007,
  basic: 0.0007,
  pro: 80,
  ultra: 100,
};

function getPlanPriceUsd(planSlugOrName: string): number | null {
  if (!planSlugOrName || typeof planSlugOrName !== 'string') return null;
  const key = planSlugOrName.trim().toLowerCase();
  const price = SUBSCRIPTION_PLAN_USD[key];
  return typeof price === 'number' && price > 0 ? price : null;
}

/** Obtiene el valor de venta del dólar blue desde dolarapi.com. */
async function fetchDolarBlueVenta(): Promise<number | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!res.ok) return null;
    const data = await res.json();
    const venta = data?.venta;
    const num = typeof venta === 'number' ? venta : Number(venta);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Obtiene el restauranteId asociado a un pedido (por id numérico o documentId).
 */
async function getRestauranteIdFromOrder(strapi: any, orderRef: string | number): Promise<number | null> {
  if (orderRef == null || !strapi?.db) return null;
  try {
    const order = await strapi.entityService.findOne(ORDER_UID, Number(orderRef), {
      fields: ['id'],
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!order?.restaurante) return null;
    const id = order.restaurante?.id ?? order.restaurante;
    return id != null ? Number(id) : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Resuelve el token de MP solo desde MetodosPago: por orderId o slug obtiene restauranteId,
 * luego busca el registro con provider 'mercado_pago' y active true y usa su mp_access_token.
 * No se usa process.env.MP_ACCESS_TOKEN.
 */
async function resolveMpAccessToken(
  strapi: any,
  opts: { orderId?: string | number | null; slug?: string | null; restauranteId?: number | null }
): Promise<{ token: string | null; restauranteId: number | null }> {
  let restauranteId: number | null = opts.restauranteId ?? null;
  if (restauranteId == null && opts.orderId != null && opts.orderId !== '') {
    restauranteId = await getRestauranteIdFromOrder(strapi, opts.orderId as string | number);
  }
  if (restauranteId == null && opts.slug) {
    restauranteId = await getRestauranteIdBySlug(strapi, String(opts.slug));
  }
  if (restauranteId == null) return { token: null, restauranteId: null };
  const token = await getMpAccessTokenForRestaurant(strapi, restauranteId);
  return { token, restauranteId };
}

/**
 * Obtiene MP_ACCESS_TOKEN desde la config global (config/server.ts → mercadopagoToken).
 * Usado solo como fallback cuando no hay token por restaurante (legacy).
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

/** back_urls especiales para suscripciones: redirigen a onboarding-restaurante (no a /pago-success ni /:slug/menu) */
function buildSubscriptionBackUrls(): { success: string; failure: string; pending: string } {
  const frontBase = getFrontendUrl().replace(/\/*$/, '');
  return {
    // MP agregará ?status=approved|...&payment_id=...&preference_id=...
    success: `${frontBase}/onboarding-restaurante?from=pago-success`,
    failure: `${frontBase}/onboarding-restaurante?from=pago-failure`,
    pending: `${frontBase}/onboarding-restaurante?from=pago-pending`,
  };
}

/** back_urls al frontend: una URL por restaurante /:slug/pago-* (evita mezclar slugs vía query o localStorage) */
function buildPaymentStatusBackUrls(slug?: string | null): { success: string; failure: string; pending: string } {
  const base = getPaymentStatusBaseUrl();
  const frontBase = process.env.FRONTEND_URL ? ensureHttpUrl(process.env.FRONTEND_URL).replace(/\/*$/, '') : base;
  const s = slug != null && String(slug).trim() ? encodeURIComponent(String(slug).trim()) : '';
  if (s) {
    return {
      success: `${frontBase}/${s}/pago-success`,
      failure: `${frontBase}/${s}/pago-failure`,
      pending: `${frontBase}/${s}/pago-pending`,
    };
  }
  return {
    success: `${frontBase}/pago-success`,
    failure: `${frontBase}/pago-failure`,
    pending: `${frontBase}/pago-pending`,
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
  const encSlug = slug != null && String(slug).trim() ? encodeURIComponent(String(slug).trim()) : '';

  const successFront = encSlug
    ? `${baseFront}/${encSlug}/pago-success?orderId=${encOrder}`
    : `${baseFront}/pago-success?orderId=${encOrder}`;
  const failureFront = encSlug
    ? `${baseFront}/${encSlug}/pago-failure?orderId=${encOrder}`
    : `${baseFront}/pago-failure?orderId=${encOrder}`;
  const pendingFront = encSlug
    ? `${baseFront}/${encSlug}/pago-pending?orderId=${encOrder}`
    : `${baseFront}/pago-pending?orderId=${encOrder}`;

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

  /**
   * GET /payments/mercado-pago-available?slug=xxx
   * Indica si Mercado Pago está disponible para este restaurante:
   * - Por MetodosPago (provider=mercado_pago, active): available=true, fallback=false
   * - Por .env (MP_ACCESS_TOKEN): available=true, fallback=true (modo compatibilidad)
   * - Si no hay ninguno: available=false
   */
  async getMercadoPagoAvailable(ctx: any) {
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      ctx.body = { available: false };
      return;
    }
    const slug = (ctx.request.query?.slug ?? '').toString().trim();
    try {
      if (!slug) {
        ctx.body = { available: false };
        return;
      }
      const restauranteId = await getRestauranteIdBySlug(strapi, slug);
      if (!restauranteId) {
        ctx.body = { available: false };
        return;
      }
      const tokenFromMetodos = await getMpAccessTokenForRestaurant(strapi, restauranteId);
      ctx.body = { available: Boolean(tokenFromMetodos) };
    } catch (e: any) {
      strapi?.log?.warn?.('[payments.getMercadoPagoAvailable]', e?.message);
      ctx.body = { available: false };
    }
  },

  /**
   * POST /payments/create-subscription-preference
   * Flujo de pago de suscripciones usando credenciales del restaurante 'Personal'.
   * Body: { plan: string } (slug: basic, pro, ultra o nombre: Básico, Pro, Ultra).
   * El monto se calcula en backend: precio USD del plan × dólar blue (venta). No se confía en el frontend.
   */
  async createSubscriptionPreference(ctx: any) {
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      ctx.status = 500;
      ctx.body = { ok: false, error: 'Error de configuración del servidor.' };
      return;
    }
    try {
      const { plan: planSlugOrName } = ctx.request.body || {};
      const priceUsd = getPlanPriceUsd(planSlugOrName);
      if (priceUsd == null) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Plan inválido. Debe ser uno de: Básico, Pro, Ultra (o basic, pro, ultra).' };
        return;
      }

      const dolarVenta = await fetchDolarBlueVenta();
      if (dolarVenta == null) {
        ctx.status = 503;
        ctx.body = { ok: false, error: 'No se pudo obtener la cotización del dólar. Intentá de nuevo en unos minutos.' };
        return;
      }

      const amountArs = Math.round(priceUsd * dolarVenta * 100) / 100;

      let tokenStr = await getMpAccessTokenForRestaurantByName(strapi, 'Personal');
      if (!tokenStr) {
        tokenStr = await getMpAccessTokenForRestaurantByDocumentId(strapi, PERSONAL_RESTAURANT_DOCUMENT_ID);
      }
      if (!tokenStr) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error:
            'La configuración de la plataforma está incompleta: no existe el restaurante "Personal" o no tiene métodos de pago (Mercado Pago) configurados.',
        };
        return;
      }

      const planName =
        String(planSlugOrName).toLowerCase() === 'basic' || String(planSlugOrName).toLowerCase() === 'basico'
          ? 'Básico'
          : String(planSlugOrName).toLowerCase() === 'pro'
            ? 'Pro'
            : String(planSlugOrName).toLowerCase() === 'ultra'
              ? 'Ultra'
              : String(planSlugOrName);

      const client = new MercadoPagoConfig({ accessToken: tokenStr });
      const preference = new Preference(client);
      // Para suscripciones redirigimos directo al onboarding
      const backUrls = buildSubscriptionBackUrls();
      const body: any = {
        items: [
          {
            id: '1',
            title: `Suscripción ${planName}`,
            quantity: 1,
            unit_price: amountArs,
            currency_id: 'ARS',
          },
        ],
        back_urls: backUrls,
        auto_return: 'approved',
      };

      const mpPref = await preference.create({ body });
      ctx.body = {
        ok: true,
        init_point: mpPref?.init_point,
        sandbox_init_point: mpPref?.sandbox_init_point,
        preference_id: mpPref?.id,
      };
    } catch (e: any) {
      strapi?.log?.error?.('[payments.createSubscriptionPreference]', e?.message);
      ctx.status = 500;
      ctx.body = {
        ok: false,
        error: e?.response?.data?.message ?? e?.message ?? 'Error al crear el link de pago.',
      };
    }
  },

  async createPreference(ctx: any) {
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      ctx.status = 500;
      ctx.body = { ok: false, error: 'Error de configuración del servidor. Intente más tarde.' };
      return;
    }

    try {
      const { items, cartItems, orderId, amount, slug, restauranteId: bodyRestauranteId } = ctx.request.body || {};

      // Token solo desde MetodosPago: buscar por restauranteId (body), orderId o slug (misma búsqueda: provider mercado_pago, active true)
      const { token: tokenStr, restauranteId } = await resolveMpAccessToken(strapi, {
        orderId: orderId ?? undefined,
        slug: slug ?? undefined,
        restauranteId: bodyRestauranteId ?? undefined,
      });
      strapi?.log?.info?.(
        '[payments] createPreference token: restauranteId=' + (restauranteId ?? 'n/a') + ', token=' + (tokenStr ? 'ok' : 'FALTA'),
      );
      if (!tokenStr) {
        let metodosCount = 0;
        let providers: string[] = [];
        if (strapi?.entityService && restauranteId != null) {
          try {
            const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
              filters: { restaurante: restauranteId },
              limit: 20,
            });
            metodosCount = Array.isArray(rows) ? rows.length : 0;
            providers = Array.isArray(rows) ? rows.map((r: any) => r?.provider).filter(Boolean) : [];
          } catch (_) {
            /* ignore */
          }
        }
        strapi?.log?.warn?.(
          '[payments] No se encontró MetodosPago con provider=mercado_pago y active=true.',
          { restauranteId, metodosCount, providers },
        );
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error:
            'Mercado Pago no está habilitado para este restaurante. Debe existir un método de pago con provider Mercado Pago y activo en la colección metodos_pagos.',
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
        backUrls = buildPaymentStatusBackUrls(slug ?? undefined);
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

        // Con slug del restaurante: volver directo al front /:slug/pago-* (MP agrega payment_id, etc.).
        // El flujo vía /api/payments/confirm?redirect=... puede fallar (params perdidos, token) y mostrar /payment-failure aunque MP haya cobrado.
        const slugTrimmed = slug != null && String(slug).trim() ? String(slug).trim() : '';
        backUrls = slugTrimmed
          ? buildPaymentStatusBackUrls(slugTrimmed)
          : buildBackendBackUrls(orderId, strapi?.config, slug, effectiveBaseBack);
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
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      ctx.status = 500;
      ctx.body = { error: 'Error de configuración del servidor.' };
      return;
    }
    try {
      const { token, issuer_id, payment_method_id, transaction_amount, installments, payer, description, orderId, slug } =
        ctx.request.body || {};

      const { token: accessToken } = await resolveMpAccessToken(strapi, { orderId, slug });
      if (!accessToken) {
        logPaymentEnvDiagnostics(strapi);
        ctx.status = 500;
        ctx.body = { error: 'Mercado Pago no configurado para este restaurante. Revisá MetodosPago (provider=mercado_pago) o variables de entorno.' };
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
      strapi?.log?.error?.('cardPay ERROR ->', e?.response?.data || e?.message);
      ctx.status = 500;
      ctx.body = { error: e?.message || 'Error procesando pago', details: e?.response?.data ?? null };
    }
  },

  // Confirmar pago al volver del redirect (sin webhook)
  async confirm(ctx: any) {
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      const baseFront = getPaymentStatusBaseUrl();
      ctx.status = 302;
      ctx.redirect(`${baseFront}/payment-failure?reason=config_error`);
      return;
    }
    try {
      const q = ctx.request.query || {};
      const paymentIdQ = q.payment_id ?? q.collection_id;
      const preferenceIdQ = q.preference_id ?? q.preference_id;
      const statusQ = (q.status ?? q.collection_status ?? '').toString().toLowerCase() || null;
      const orderRefQ = (q.orderRef ?? '').toString() || null;
      const wantsJson =
        String(q.format || '') === 'json' || String(ctx.request.header?.accept || '').includes('application/json');

      let accessToken: string | null = null;
      let orderRef: string | number | null = orderRefQ || null;
      let status: string | null = statusQ;
      let rawPayment: any = null;

      if (orderRefQ) {
        const restauranteId = await getRestauranteIdFromOrder(strapi, orderRefQ);
        accessToken = restauranteId ? await getMpAccessTokenForRestaurant(strapi, restauranteId) : null;
      }

      if (paymentIdQ && accessToken) {
        try {
          const client = new MercadoPagoConfig({ accessToken });
          const mpPayment: any = await new Payment(client).get({ id: String(paymentIdQ) });
          rawPayment = mpPayment;
          orderRef = mpPayment?.external_reference ?? mpPayment?.metadata?.order_id ?? orderRef;
          status = (mpPayment?.status ?? status)?.toLowerCase() || null;
        } catch (err: any) {
          strapi?.log?.warn?.(`[payments.confirm] payment get (token por orderRef) falló ${paymentIdQ}: ${err?.message}`);
        }
      }

      if (paymentIdQ && !rawPayment) {
        const fetched = await fetchMpPaymentWithAnyToken(strapi, String(paymentIdQ));
        if (fetched?.payment) {
          rawPayment = fetched.payment;
          orderRef = fetched.payment.external_reference ?? fetched.payment.metadata?.order_id ?? orderRef;
          status = (fetched.payment.status ?? status)?.toLowerCase() || null;
          const rid = orderRef ? await getRestauranteIdFromOrder(strapi, orderRef) : null;
          accessToken = rid ? await getMpAccessTokenForRestaurant(strapi, rid) : fetched.tokenUsed;
        }
      }

      if (!orderRef && preferenceIdQ) {
        const prefFetched = await fetchMpPreferenceWithAnyToken(strapi, String(preferenceIdQ));
        if (prefFetched?.preference) {
          orderRef = prefFetched.preference.external_reference ?? null;
          status = status || 'approved';
          if (!accessToken && orderRef) {
            const rid = await getRestauranteIdFromOrder(strapi, orderRef);
            accessToken = rid ? await getMpAccessTokenForRestaurant(strapi, rid) : prefFetched.tokenUsed;
          }
        }
      }

      if (!accessToken) {
        logPaymentEnvDiagnostics(strapi);
        if (wantsJson) {
          ctx.status = 502;
          ctx.body = { ok: false, error: 'Mercado Pago no configurado o no se pudo resolver el token del restaurante.' };
          return;
        }
        const baseFront = getPaymentStatusBaseUrl();
        ctx.status = 302;
        ctx.redirect(`${baseFront}/payment-failure?reason=config_error`);
        return;
      }

      if (!orderRef) {
        strapi?.log?.warn?.('[payments.confirm] No se pudo determinar orderId (external_reference/orderRef).');
        if (wantsJson) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'no_order_ref' };
          return;
        }
        const baseFront = getPaymentStatusBaseUrl();
        ctx.status = 302;
        ctx.redirect(`${baseFront}/payment-failure?reason=no_order_ref`);
        return;
      }

      const orderPk = await resolveOrderPk(strapi, orderRef);
      if (!orderPk) {
        strapi?.log?.warn?.(`[payments.confirm] Pedido no encontrado para ref: ${orderRef}.`);
        if (wantsJson) {
          ctx.status = 404;
          ctx.body = { ok: false, error: 'order_not_found', orderRef: String(orderRef) };
          return;
        }
        const baseFront = getPaymentStatusBaseUrl();
        ctx.status = 302;
        ctx.redirect(`${baseFront}/payment-failure?reason=order_not_found&orderRef=${encodeURIComponent(String(orderRef))}`);
        return;
      }

      const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
      const shouldMarkPaid = normalizedStatus === 'approved';
      if (shouldMarkPaid) {
        await markOrderPaid(strapi, orderPk);
        try {
          await notifyPagoMercadoPagoForOrder(strapi, orderPk, {
            amount: rawPayment != null ? Number(rawPayment.transaction_amount) : null,
            currency: rawPayment?.currency_id ? String(rawPayment.currency_id) : 'ARS',
            paidAt: new Date().toISOString(),
            mpPaymentId: paymentIdQ ? String(paymentIdQ) : null,
          });
        } catch (e: any) {
          strapi?.log?.warn?.('[payments.confirm] notify failed:', e?.message ?? e);
        }
      } else {
        strapi?.log?.info?.(`[payments.confirm] Estado no aprobado (${normalizedStatus}). No marco paid.`);
      }

      if (wantsJson) {
        ctx.status = 200;
        ctx.body = {
          ok: true,
          orderId: orderPk,
          status: normalizedStatus || 'approved',
        };
        return;
      }

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

      // 6) Redirección al front: nunca devolver JSON aquí para que el usuario no vea JSON tras el pago.
      // MP a veces reemplaza la query al redirigir y se pierde "redirect"; en ese caso construimos la URL.
      const redirectParam = (ctx.request.query?.redirect as string) || null;
      if (redirectParam) {
        try {
          const dest = ensureHttpUrl(redirectParam);
          ctx.status = 302;
          ctx.redirect(dest);
          return;
        } catch (_) {
          /* redirect inválido, usar fallback */
        }
      }

      // Fallback: construir URL de éxito en el frontend (evita que el usuario vea JSON).
      const baseFront = getPaymentStatusBaseUrl();
      const dest =
        `${baseFront}/pago/success?orderId=${encodeURIComponent(String(orderPk))}&status=${encodeURIComponent(normalizedStatus || 'approved')}` +
        (paymentIdQ ? `&payment_id=${encodeURIComponent(String(paymentIdQ))}` : '');
      ctx.status = 302;
      ctx.redirect(dest);
      return;
    } catch (e: any) {
      strapi?.log?.error?.('[payments.confirm] ', e?.response?.data || e?.message);
      const baseFront = getPaymentStatusBaseUrl();
      ctx.status = 302;
      ctx.redirect(`${baseFront}/payment-failure?reason=error`);
    }
  },

  /**
   * POST /restaurants/:slug/payments
   * Mock/Manual payment creation
   */
  async create(ctx: any) {
    const strapi = getStrapi(ctx);
    if (!strapi?.entityService) {
      ctx.status = 500;
      ctx.body = { data: { ok: false, error: 'Error de configuración del servidor.' } };
      return;
    }
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

