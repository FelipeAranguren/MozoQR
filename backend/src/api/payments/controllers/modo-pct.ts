/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createModoPayment,
  getModoPaymentStatus,
  getModoPctConfigFromEnv,
  ModoPctError,
  simulateModoApprovedOrderUpdate,
  verifyModoWebhookSecret,
  type ModoCreatePaymentBody,
} from '../../../services/modoPctClient';

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
      error:
        'MODO no configurado: definí MODO_BASE_URL (o MODO_PCP_BASE_URL), MODO_CLIENT_ID, MODO_CLIENT_SECRET y MODO_BEARER_TOKEN.',
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
 * Consulta estado en MODO GET /pcp/{bcra}/payment/{trx_id}.
 */
async function getPaymentStatus(ctx: any) {
  const config = getModoPctConfigFromEnv();
  if (!config) {
    ctx.status = 503;
    ctx.body = {
      ok: false,
      error:
        'MODO no configurado: definí MODO_BASE_URL (o MODO_PCP_BASE_URL), MODO_CLIENT_ID, MODO_CLIENT_SECRET y MODO_BEARER_TOKEN.',
    };
    return;
  }

  const trxId = (ctx.params?.trxId ?? ctx.params?.trx_id ?? '').toString().trim();
  if (!trxId) {
    ctx.status = 400;
    ctx.body = { ok: false, error: 'Falta trx_id en la ruta.' };
    return;
  }

  try {
    const status = await getModoPaymentStatus(trxId, config);
    ctx.status = 200;
    ctx.body = { ok: true, status };
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

/**
 * POST /api/payments/modo/webhook
 * Notificaciones MODO: si status indica APPROVED, simula marcar el pedido como pagado.
 * Body esperado (flexible): { status: { code: "APPROVED" }, payment?: { trx_id }, orderId?: "..." }
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

  const trxRaw =
    (body.trx_id as string) ||
    (body.trxId as string) ||
    (typeof body.payment === 'object' && body.payment !== null && (body.payment as any).trx_id) ||
    '';
  const trxId = typeof trxRaw === 'string' ? trxRaw.trim() : '';

  const orderId = pickOrderIdFromWebhookBody(body);

  if (effective === 'APPROVED' && orderId) {
    simulateModoApprovedOrderUpdate(orderId, trxId || `unknown-${Date.now()}`);
    strapi?.log?.info?.(
      `[modo webhook] Simulación DB: pedido ${orderId} → order_status=paid (trx_id=${trxId || 'n/a'})`,
    );
    ctx.status = 200;
    ctx.body = { ok: true, received: true, orderId, trxId: trxId || null, simulated: true };
    return;
  }

  if (effective === 'APPROVED' && !orderId) {
    strapi?.log?.warn?.('[modo webhook] APPROVED sin orderId/external_reference; no se actualiza pedido.');
    ctx.status = 200;
    ctx.body = { ok: true, received: true, warning: 'missing_order_id' };
    return;
  }

  ctx.status = 200;
  ctx.body = { ok: true, received: true, ignored: true, status: effective || null };
}

export default {
  createPayment,
  getPaymentStatus,
  webhook,
};
