/**
 * Cliente HTTP para PCT Online (MODO) según modo-pct-api.json.
 * Requiere: MODO_BASE_URL (o MODO_PCP_BASE_URL), MODO_CLIENT_ID, MODO_CLIENT_SECRET, MODO_BEARER_TOKEN.
 * MODO_BASE_URL: prefijo hasta /pcp/{bcra_id} sin "/payment" (ej. https://.../connections/pcp/999).
 */

import type { IncomingHttpHeaders } from 'node:http';

/** Cuerpo POST /pcp/{bcra_id}/payment (subset del OpenAPI). */
export interface ModoCreatePaymentBody {
  trx_id?: string;
  qr_raw?: string;
  amount?: { value?: number };
  payer?: { account?: string; cuit?: string };
  merchant?: { account?: string; cuit?: string };
  acquirer?: { reverse_domain?: string; cuit?: string };
  [key: string]: unknown;
}

export interface ModoStatus {
  code?: string;
  message?: string;
}

export interface ModoCreatePaymentResponse {
  payment?: Record<string, unknown>;
  status?: ModoStatus;
}

/** Intenta obtener URL de checkout / deep link desde la respuesta PCT (nombres habituales de MODO). */
export function extractCheckoutUrl(res: ModoCreatePaymentResponse): string | null {
  const pay = res.payment;
  const tryVal = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
    return null;
  };
  if (pay && typeof pay === 'object') {
    const keys = [
      'checkoutUrl',
      'checkout_url',
      'checkoutURL',
      'deep_link',
      'deepLink',
      'redirectUrl',
      'redirect_url',
      'payment_url',
      'url',
    ];
    for (const k of keys) {
      const u = tryVal((pay as Record<string, unknown>)[k]);
      if (u) return u;
    }
  }
  const top = res as unknown as Record<string, unknown>;
  for (const k of ['checkoutUrl', 'checkout_url', 'deep_link']) {
    const u = tryVal(top[k]);
    if (u) return u;
  }
  return null;
}

export type PendingModoCheckout = { orderIds: string[]; slug: string; createdAt: number };

const pendingModoByTrx = new Map<string, PendingModoCheckout>();
const webhookApprovedTrxs = new Set<string>();

export function registerPendingModoCheckout(trxId: string, meta: { orderIds: string[]; slug: string }): void {
  pendingModoByTrx.set(trxId, { ...meta, createdAt: Date.now() });
}

export function getPendingModoCheckout(trxId: string): PendingModoCheckout | undefined {
  return pendingModoByTrx.get(trxId);
}

export function clearPendingModoCheckout(trxId: string): void {
  pendingModoByTrx.delete(trxId);
}

export function markModoTrxApprovedByWebhook(trxId: string): void {
  webhookApprovedTrxs.add(trxId);
}

export function isModoTrxWebhookApproved(trxId: string): boolean {
  return webhookApprovedTrxs.has(trxId);
}

export interface ModoPctConfig {
  /** URL base sin trailing slash; debe incluir /pcp/{bcra_id} */
  pcpBaseUrl: string;
  clientId: string;
  clientSecret: string;
  bearerToken: string;
}

export class ModoPctError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly modoError?: string,
    public readonly rawBody?: unknown,
  ) {
    super(message);
    this.name = 'ModoPctError';
  }
}

function trimEnv(key: string): string {
  const v = process.env[key];
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

/**
 * Resuelve configuración desde env. Falta de credenciales → null.
 */
export function getModoPctConfigFromEnv(): ModoPctConfig | null {
  const base =
    trimEnv('MODO_PCP_BASE_URL') ||
    trimEnv('MODO_BASE_URL') ||
    '';
  const clientId = trimEnv('MODO_CLIENT_ID');
  const clientSecret = trimEnv('MODO_CLIENT_SECRET');
  const bearerToken = trimEnv('MODO_BEARER_TOKEN') || trimEnv('MODO_ACCESS_TOKEN');
  if (!base || !clientId || !clientSecret || !bearerToken) return null;
  return {
    pcpBaseUrl: base.replace(/\/+$/, ''),
    clientId,
    clientSecret,
    bearerToken,
  };
}

function buildAuthHeaders(config: ModoPctConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.bearerToken}`,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function extractModoError(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const e = (payload as { error?: unknown }).error;
    return typeof e === 'string' ? e : undefined;
  }
  return undefined;
}

async function parseJsonSafe(text: string): Promise<unknown> {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

/**
 * POST /pcp/{bcra_id}/payment — crea el pago. 201 + CreatePaymentResponse.
 */
export async function createModoPayment(
  body: ModoCreatePaymentBody,
  config: ModoPctConfig,
): Promise<ModoCreatePaymentResponse> {
  const url = `${config.pcpBaseUrl}/payment`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders(config),
      body: JSON.stringify(body ?? {}),
    });
  } catch (e) {
    throw new ModoPctError('No se pudo conectar con el servicio MODO', 502, undefined, e);
  }

  const text = await res.text();
  const payload = await parseJsonSafe(text);

  if (res.status === 201) {
    return (payload ?? {}) as ModoCreatePaymentResponse;
  }

  const modoErr = extractModoError(payload) ?? res.statusText;

  if (res.status === 400) {
    throw new ModoPctError('Datos inválidos o token inválido/expirado (MODO 400)', 400, modoErr, payload);
  }
  if (res.status === 500) {
    throw new ModoPctError('Error realizando el pago en MODO (500)', 502, modoErr, payload);
  }

  throw new ModoPctError(`Respuesta inesperada de MODO (${res.status})`, res.status >= 500 ? 502 : 400, modoErr, payload);
}

/**
 * GET /pcp/{bcra_id}/payment/{trx_id} — estado del pago.
 */
export async function getModoPaymentStatus(trxId: string, config: ModoPctConfig): Promise<ModoStatus> {
  const id = encodeURIComponent(String(trxId).trim());
  const url = `${config.pcpBaseUrl}/payment/${id}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(config),
    });
  } catch (e) {
    throw new ModoPctError('No se pudo conectar con el servicio MODO', 502, undefined, e);
  }

  const text = await res.text();
  const payload = await parseJsonSafe(text);

  if (res.status === 200) {
    return (payload ?? {}) as ModoStatus;
  }

  const modoErr = extractModoError(payload) ?? res.statusText;

  if (res.status === 400) {
    throw new ModoPctError('Solicitud inválida al consultar pago (MODO 400)', 400, modoErr, payload);
  }
  if (res.status === 500) {
    throw new ModoPctError('Error del servicio MODO al consultar pago (500)', 502, modoErr, payload);
  }

  throw new ModoPctError(`Respuesta inesperada de MODO (${res.status})`, res.status >= 500 ? 502 : 400, modoErr, payload);
}

/** Simulación de persistencia de pedidos actualizados por webhook (reemplazar por Strapi entityService). */
const simulatedOrderByTrx = new Map<
  string,
  { orderId: string; trxId: string; order_status: string; updatedAt: string }
>();

export function simulateModoApprovedOrderUpdate(orderId: string, trxId: string): void {
  simulatedOrderByTrx.set(trxId, {
    orderId,
    trxId,
    order_status: 'paid',
    updatedAt: new Date().toISOString(),
  });
}

export function getSimulatedModoOrderSnapshot(trxId: string) {
  return simulatedOrderByTrx.get(trxId) ?? null;
}

/** Intenta leer el secret del webhook desde header (opcional). */
export function verifyModoWebhookSecret(headers: IncomingHttpHeaders): boolean {
  const expected = trimEnv('MODO_WEBHOOK_SECRET');
  if (!expected) return true;
  const got =
    (headers['x-modo-signature'] as string) ||
    (headers['x-webhook-secret'] as string) ||
    (headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
    '';
  return got === expected;
}
