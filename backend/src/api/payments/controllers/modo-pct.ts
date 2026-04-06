/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import {
  createModoPayment,
  extractCheckoutUrl,
  getModoPaymentStatus,
  getModoPctConfigFromEnv,
  getModoPctEnvMissingKeys,
  getPendingModoCheckout,
  isModoTrxWebhookApproved,
  markModoTrxApprovedByWebhook,
  ModoPctError,
  registerPendingModoCheckout,
  simulateModoApprovedOrderUpdate,
  verifyModoWebhookSecret,
  type ModoCreatePaymentBody,
} from '../../../services/modoPctClient';

const ORDER_UID = 'api::pedido.pedido';

function getStrapi(ctx: any): any {
  return ctx?.strapi ?? (typeof global !== 'undefined' && (global as any).__STRAPI__) ?? null;
}

function respondModoError(ctx: any, err: unknown) {
  if (err instanceof ModoPctError) {
    ctx.status = err.statusCode;
    ctx.body = {
      ok: false,
      error: err.modoError ?? err.message,
      details: err.rawBody ?? undefined,
    };
    return;
  }
  const strapi = getStrapi(ctx);
  strapi?.log?.error?.('[modo-pct]', err);
  ctx.status = 500;
  ctx.body = { ok: false, error: err instanceof Error ? err.message : 'Error interno' };
}

async function markOrderPaid(strapi: any, orderPk: number): Promise<boolean> {
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
      /* siguiente */
    }
  }
  strapi?.log?.error?.(`[modo-pct] No se pudo marcar pedido ${orderPk} como pagado.`);
  return false;
}

async function resolveOrderPk(strapi: any, ref: string | number | null): Promise<number | null> {
  if (ref == null) return null;
  const refStr = String(ref).trim();
  if (/^\d+$/.test(refStr)) {
    try {
      const existing = await strapi.entityService.findOne(ORDER_UID, Number(refStr), { fields: ['id'] });
      if (existing?.id) return Number(existing.id);
    } catch {
      /* */
    }
  }
  try {
    const byDocument = await strapi.db.query(ORDER_UID).findOne({
      where: { documentId: refStr },
      select: ['id'],
    });
    if (byDocument?.id) return Number(byDocument.id);
  } catch {
    /* */
  }
  return null;
}

/**
 * POST /api/payments/create-modo-checkout
 * Crea el pago en MODO PCT y devuelve checkoutUrl + trx_id para el cliente.
 */
async function createModoCheckout(ctx: any) {
  const strapi = getStrapi(ctx);
  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const slug = String(body.slug ?? '').trim();
  const total = Number(body.total);
  const table = body.table != null ? body.table : undefined;
  const tableSessionId = body.tableSessionId != null ? body.tableSessionId : undefined;
  const orderIdsRaw = body.orderIds;
  const orderIds = Array.isArray(orderIdsRaw)
    ? orderIdsRaw.map((x) => String(x)).filter((s) => s.length > 0)
    : [];

  if (!slug) {
    ctx.status = 400;
    ctx.body = { ok: false, error: 'Falta slug del restaurante.' };
    return;
  }
  if (!Number.isFinite(total) || total <= 0) {
    ctx.status = 400;
    ctx.body = { ok: false, error: 'Monto total inválido.' };
    return;
  }
  if (orderIds.length === 0) {
    ctx.status = 400;
    ctx.body = { ok: false, error: 'Se requiere al menos un pedido (orderIds).' };
    return;
  }

  const config = getModoPctConfigFromEnv();
  if (!config) {
    const missing = getModoPctEnvMissingKeys();
    ctx.status = 503;
    ctx.body = {
      ok: false,
      error:
        'MODO no está listo en el servidor: completá el .env del backend (Strapi), guardá y reiniciá el proceso.',
      missing,
      hint:
        'En tu .env definí al menos: MODO_BASE_URL, MODO_CLIENT_ID, MODO_CLIENT_SECRET y MODO_BEARER_TOKEN (JWT de MODO Conexiones).',
    };
    return;
  }

  if (!strapi?.db) {
    ctx.status = 500;
    ctx.body = { ok: false, error: 'Servidor no disponible.' };
    return;
  }

  let restaurante: any;
  try {
    restaurante = await strapi.db.query('api::restaurante.restaurante').findOne({
      where: { slug },
      select: ['id', 'modo_store_id', 'modo_terminal_id', 'pct_merchant_cbu_alias'],
    });
  } catch (e: any) {
    strapi?.log?.error?.('[createModoCheckout] DB', e?.message);
    ctx.status = 500;
    ctx.body = { ok: false, error: 'No se pudo leer el restaurante.' };
    return;
  }

  if (!restaurante?.id) {
    ctx.status = 404;
    ctx.body = { ok: false, error: 'Restaurante no encontrado.' };
    return;
  }

  const storeId = String(restaurante.modo_store_id ?? '').trim();
  const terminalId = String(restaurante.modo_terminal_id ?? '').trim();
  const cbu = String(restaurante.pct_merchant_cbu_alias ?? '').trim();

  if (!storeId || !terminalId || !cbu) {
    ctx.status = 400;
    ctx.body = {
      ok: false,
      error: 'El restaurante no tiene configurados MODO Store ID, Terminal ID y CBU/alias.',
    };
    return;
  }

  const merchantCuit =
    typeof process.env.MODO_MERCHANT_CUIT === 'string' ? process.env.MODO_MERCHANT_CUIT.trim() : '';

  const trx_id = `mzqr-${randomUUID()}`;

  const modoBody: ModoCreatePaymentBody = {
    trx_id,
    amount: { value: Math.round(total * 100) / 100 },
    merchant: {
      account: cbu,
      ...(merchantCuit ? { cuit: merchantCuit } : {}),
    },
  };
  (modoBody as Record<string, unknown>).store_id = storeId;
  (modoBody as Record<string, unknown>).terminal_id = terminalId;
  if (table != null) (modoBody as Record<string, unknown>).table = table;
  if (tableSessionId != null) (modoBody as Record<string, unknown>).table_session_id = tableSessionId;
  (modoBody as Record<string, unknown>).order_ids = orderIds;

  try {
    const data = await createModoPayment(modoBody, config);
    const pay = data.payment && typeof data.payment === 'object' ? (data.payment as Record<string, unknown>) : {};
    const trxFromApi = typeof pay.trx_id === 'string' && pay.trx_id.trim() ? pay.trx_id.trim() : trx_id;
    const checkoutUrl = extractCheckoutUrl(data);

    if (!checkoutUrl) {
      strapi?.log?.warn?.('[createModoCheckout] MODO no devolvió checkoutUrl reconocible', {
        keys: pay ? Object.keys(pay) : [],
      });
      ctx.status = 502;
      ctx.body = {
        ok: false,
        error:
          'MODO no devolvió una URL de checkout reconocible. Revisá la respuesta de la API o el formato del entorno.',
        details: data,
      };
      return;
    }

    registerPendingModoCheckout(trxFromApi, { orderIds, slug });

    ctx.status = 200;
    ctx.body = {
      ok: true,
      trx_id: trxFromApi,
      checkoutUrl,
      status: data.status ?? null,
    };
  } catch (e) {
    respondModoError(ctx, e);
  }
}

/**
 * POST /api/payments/modo/payment
 * Proxy al POST MODO /pcp/{bcra}/payment con Bearer + client_id + client_secret.
 */
async function createPayment(ctx: any) {
  const config = getModoPctConfigFromEnv();
  if (!config) {
    ctx.status = 503;
    ctx.body = {
      ok: false,
      error: 'MODO no configurado en el servidor.',
      missing: getModoPctEnvMissingKeys(),
    };
    return;
  }

  const body = (ctx.request.body ?? {}) as ModoCreatePaymentBody;
  try {
    const data = await createModoPayment(body, config);
    ctx.status = 201;
    ctx.body = { ok: true, ...data };
  } catch (e) {
    respondModoError(ctx, e);
  }
}

/**
 * GET /api/payments/modo/payment/:trxId
 * Estado: primero webhook interno, luego API MODO.
 */
async function getPaymentStatus(ctx: any) {
  const trxId = (ctx.params?.trxId ?? ctx.params?.trx_id ?? '').toString().trim();
  if (!trxId) {
    ctx.status = 400;
    ctx.body = { ok: false, error: 'Falta trx_id en la ruta.' };
    return;
  }

  if (isModoTrxWebhookApproved(trxId)) {
    ctx.status = 200;
    ctx.body = { ok: true, status: { code: 'APPROVED', message: 'confirmed_by_webhook' }, source: 'webhook' };
    return;
  }

  const config = getModoPctConfigFromEnv();
  if (!config) {
    ctx.status = 503;
    ctx.body = {
      ok: false,
      error: 'MODO no configurado en el servidor.',
      missing: getModoPctEnvMissingKeys(),
    };
    return;
  }

  try {
    const status = await getModoPaymentStatus(trxId, config);
    ctx.status = 200;
    ctx.body = { ok: true, status, source: 'modo' };
  } catch (e) {
    respondModoError(ctx, e);
  }
}

function normalizeStatusCode(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim().toUpperCase();
  if (typeof raw === 'object' && raw !== null && 'code' in raw) {
    const c = (raw as { code?: unknown }).code;
    return typeof c === 'string' ? c.trim().toUpperCase() : '';
  }
  return '';
}

function pickOrderIdFromWebhookBody(body: Record<string, unknown>): string | null {
  const direct = body.orderId ?? body.order_id ?? body.external_reference ?? body.externalReference;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);

  const payment = body.payment;
  if (payment && typeof payment === 'object') {
    const p = payment as Record<string, unknown>;
    const ref = p.external_reference ?? p.externalReference ?? p.orderId;
    if (typeof ref === 'string' && ref.trim()) return ref.trim();
  }

  const meta = body.metadata;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    const oid = m.orderId ?? m.order_id;
    if (typeof oid === 'string' && oid.trim()) return oid.trim();
  }

  return null;
}

function extractTrxIdFromWebhook(body: Record<string, unknown>): string {
  const raw =
    (body.trx_id as string) ||
    (body.trxId as string) ||
    (typeof body.payment === 'object' && body.payment !== null && (body.payment as any).trx_id) ||
    '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * POST /api/payments/modo/webhook
 */
async function webhook(ctx: any) {
  const strapi = getStrapi(ctx);

  if (!verifyModoWebhookSecret(ctx.request.headers || {})) {
    ctx.status = 401;
    ctx.body = { ok: false, error: 'unauthorized' };
    return;
  }

  const body = (ctx.request.body ?? {}) as Record<string, unknown>;
  const statusCode = normalizeStatusCode(body.status ?? (body as any).Status);
  const alt = normalizeStatusCode(body);
  const effective = statusCode || alt;

  const trxId = extractTrxIdFromWebhook(body);
  const orderIdSingle = pickOrderIdFromWebhookBody(body);
  const pending = trxId ? getPendingModoCheckout(trxId) : undefined;
  const fromPending = pending?.orderIds ?? [];

  if (effective === 'APPROVED') {
    if (trxId) markModoTrxApprovedByWebhook(trxId);

    const idSet = new Set<string>([...fromPending, ...(orderIdSingle ? [orderIdSingle] : [])]);
    const ids = Array.from(idSet).filter(Boolean);

    if (strapi?.entityService && ids.length > 0) {
      for (const ref of ids) {
        const pk = await resolveOrderPk(strapi, ref);
        if (pk != null) await markOrderPaid(strapi, pk);
      }
    }

    if (ids.length > 0 && trxId) {
      for (const ref of ids) {
        simulateModoApprovedOrderUpdate(ref, trxId);
      }
    }

    strapi?.log?.info?.(
      `[modo webhook] APPROVED trx=${trxId || 'n/a'} orders=${ids.join(',') || 'none'}`,
    );
    ctx.status = 200;
    ctx.body = { ok: true, received: true, trxId: trxId || null, orderIds: ids };
    return;
  }

  ctx.status = 200;
  ctx.body = { ok: true, received: true, ignored: true, status: effective || null };
}

export default {
  createModoCheckout,
  createPayment,
  getPaymentStatus,
  webhook,
};
