/**
 * Cliente HTTP para PCT Online (MODO) según modo-pct-api.json.
 * Requiere: MODO_BASE_URL (o MODO_PCP_BASE_URL), MODO_CLIENT_ID, MODO_CLIENT_SECRET.
 * Bearer: si MODO_BEARER_TOKEN está vacío, OAuth2 client_credentials contra …/connections/pcp/{bcra_id}/token (misma base que PCP) o MODO_TOKEN_URL.
 * MODO_BASE_URL: prefijo hasta /pcp/{bcra_id} sin "/payment" (ej. https://.../connections/pcp/999).
 */

/** Cabeceras de request (compatible con Koa/Strapi y Node). */
export type ModoWebhookRequestHeaders = Record<string, string | string[] | undefined>;

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
  const env = process.env as Record<string, string | undefined>;
  const v = env[key];
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

const MODO_AUTH_FETCH_TIMEOUT_MS = 10_000;

/**
 * Token PCP (MODO Conexiones): POST {MODO_BASE_URL}/token — no existe en /v2/auth/token (404).
 * Override: MODO_TOKEN_URL (URL completa).
 */
function resolveModoTokenUrl(): string {
  const override = trimEnv('MODO_TOKEN_URL');
  if (override) {
    return override.replace(/\/+$/, '');
  }

  const base = trimEnv('MODO_PCP_BASE_URL') || trimEnv('MODO_BASE_URL');
  if (!base) {
    throw new ModoPctError(
      'Falta MODO_BASE_URL para armar la URL del token PCP (…/connections/pcp/{bcra_id}/token).',
      503,
      undefined,
      { missing: getModoPctEnvMissingKeys() },
    );
  }
  const trimmed = base.replace(/\/+$/, '');
  if (!/\/pcp\/[^/]+$/i.test(trimmed)) {
    throw new ModoPctError(
      'MODO_BASE_URL debe terminar en …/connections/pcp/{bcra_id} para derivar el token, o definí MODO_TOKEN_URL con la URL completa.',
      503,
      undefined,
      {
        missing: [
          'MODO_BASE_URL (formato …/pcp/{bcra_id}) o MODO_TOKEN_URL',
        ],
      },
    );
  }
  return `${trimmed}/token`;
}

/** Lista variables de entorno obligatorias (sin contar el bearer: se obtiene por OAuth si no está en .env). */
export function getModoPctEnvMissingKeys(): string[] {
  const missing: string[] = [];
  if (!trimEnv('MODO_PCP_BASE_URL') && !trimEnv('MODO_BASE_URL')) {
    missing.push('MODO_BASE_URL (o MODO_PCP_BASE_URL)');
  }
  if (!trimEnv('MODO_CLIENT_ID')) missing.push('MODO_CLIENT_ID');
  if (!trimEnv('MODO_CLIENT_SECRET')) missing.push('MODO_CLIENT_SECRET');
  return missing;
}

function getStaticBearerFromEnv(): string {
  return trimEnv('MODO_BEARER_TOKEN') || trimEnv('MODO_ACCESS_TOKEN');
}

/** Caché en memoria del access_token OAuth (evita golpear /auth/token en cada request). */
let modoTokenCache: { accessToken: string; expiresAtMs: number } | null = null;
let modoTokenInflight: Promise<string> | null = null;

const TOKEN_REFRESH_SKEW_SEC = 120;

export function invalidateModoTokenCache(): void {
  modoTokenCache = null;
}

/**
 * POST token PCP (client_credentials). No usa caché.
 * URL: MODO_TOKEN_URL o {MODO_BASE_URL}/token.
 */
export async function getModoToken(): Promise<{ accessToken: string; expiresInSec: number }> {
  const clientId = trimEnv('MODO_CLIENT_ID');
  const clientSecret = trimEnv('MODO_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new ModoPctError('Faltan MODO_CLIENT_ID o MODO_CLIENT_SECRET', 503, undefined, {
      missing: getModoPctEnvMissingKeys(),
    });
  }
  const { token, expiresInSec } = await fetchFreshModoAccessToken(clientId, clientSecret);
  return { accessToken: token, expiresInSec };
}

function parseModoTokenFromPayload(data: Record<string, unknown>): { token: string; expiresInSec: number } {
  const access =
    (typeof data.access_token === 'string' && data.access_token) ||
    (typeof data.accessToken === 'string' && data.accessToken) ||
    (typeof data.token === 'string' && data.token) ||
    '';
  if (!access.trim()) {
    throw new ModoPctError('Auth MODO: la respuesta no incluye access_token', 502, undefined, data);
  }
  let expiresIn = Number(data.expires_in ?? data.expiresIn);
  if (!Number.isFinite(expiresIn) || expiresIn < 60) {
    expiresIn = 3600;
  }
  return { token: access.trim(), expiresInSec: expiresIn };
}

function modoAuthErrorFromResponse(res: Response, data: Record<string, unknown>): ModoPctError {
  const msg =
    (typeof data.error_description === 'string' && data.error_description) ||
    (typeof data.error === 'string' && data.error) ||
    res.statusText;
  return new ModoPctError(`Auth MODO falló (${res.status})`, res.status >= 500 ? 502 : 503, msg, data);
}

/**
 * POST sin Authorization. Primero x-www-form-urlencoded (doc MODO PCP); si 415/406, JSON. Timeout 10s por intento.
 */
async function postModoAuthTokenRequest(
  clientId: string,
  clientSecret: string,
): Promise<{ token: string; expiresInSec: number }> {
  const authUrl = resolveModoTokenUrl();
  console.log('[MODO Auth] URL completa intentada:', authUrl);

  const formBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const jsonBody = JSON.stringify({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
      signal: AbortSignal.timeout(MODO_AUTH_FETCH_TIMEOUT_MS),
    });
  } catch (netErr: unknown) {
    const name = netErr instanceof Error ? netErr.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new ModoPctError(
        'Auth MODO: timeout esperando respuesta del token (10s)',
        504,
        undefined,
        netErr,
      );
    }
    throw new ModoPctError('Auth MODO: error de red al contactar el endpoint de token', 502, undefined, netErr);
  }

  let text = await res.text();
  let data = (await parseJsonSafe(text)) as Record<string, unknown>;

  if (!res.ok && (res.status === 415 || res.status === 406)) {
    console.log('[MODO Auth] reintento application/json, URL:', authUrl);
    try {
      res = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonBody,
        signal: AbortSignal.timeout(MODO_AUTH_FETCH_TIMEOUT_MS),
      });
    } catch (netErr: unknown) {
      const name = netErr instanceof Error ? netErr.name : '';
      if (name === 'AbortError' || name === 'TimeoutError') {
        throw new ModoPctError(
          'Auth MODO: timeout esperando respuesta del token (10s)',
          504,
          undefined,
          netErr,
        );
      }
      throw new ModoPctError('Auth MODO: error de red al contactar el endpoint de token', 502, undefined, netErr);
    }
    text = await res.text();
    data = (await parseJsonSafe(text)) as Record<string, unknown>;
  }

  if (!res.ok) {
    if (res.status === 404) {
      console.error('URL de Auth fallida: ' + authUrl);
    }
    throw modoAuthErrorFromResponse(res, data);
  }

  return parseModoTokenFromPayload(data);
}

async function fetchFreshModoAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<{ token: string; expiresInSec: number }> {
  return postModoAuthTokenRequest(clientId, clientSecret);
}

async function getModoAccessTokenCached(clientId: string, clientSecret: string): Promise<string> {
  const staticBearer = getStaticBearerFromEnv();
  if (staticBearer) return staticBearer;

  const now = Date.now();
  const skewMs = TOKEN_REFRESH_SKEW_SEC * 1000;
  if (modoTokenCache && modoTokenCache.expiresAtMs > now + skewMs) {
    return modoTokenCache.accessToken;
  }

  if (modoTokenInflight) return modoTokenInflight;

  modoTokenInflight = (async () => {
    try {
      const { token, expiresInSec } = await fetchFreshModoAccessToken(clientId, clientSecret);
      const t = Date.now();
      modoTokenCache = {
        accessToken: token,
        expiresAtMs: t + Math.max(TOKEN_REFRESH_SKEW_SEC, expiresInSec - TOKEN_REFRESH_SKEW_SEC) * 1000,
      };
      return token;
    } finally {
      modoTokenInflight = null;
    }
  })();

  return modoTokenInflight;
}

/**
 * Config lista para llamar PCT: base URL + client_id/secret en headers + Bearer (env estático u OAuth cacheado).
 */
export async function getModoPctConfigAsync(): Promise<ModoPctConfig> {
  const missing = getModoPctEnvMissingKeys();
  if (missing.length > 0) {
    throw new ModoPctError(
      'MODO no está listo: faltan variables de entorno en el servidor (Strapi). En Railway u otro host, cargalas en el panel de Variables y redeploy; el archivo .env local no se incluye en el deploy.',
      503,
      undefined,
      { missing },
    );
  }

  const base =
    trimEnv('MODO_PCP_BASE_URL') ||
    trimEnv('MODO_BASE_URL') ||
    '';
  const clientId = trimEnv('MODO_CLIENT_ID');
  const clientSecret = trimEnv('MODO_CLIENT_SECRET');

  const bearerToken = await getModoAccessTokenCached(clientId, clientSecret);

  return {
    pcpBaseUrl: base.replace(/\/+$/, ''),
    clientId,
    clientSecret,
    bearerToken,
  };
}

/** true si el Bearer no viene de .env (se usa OAuth + caché). */
export function modoPctUsesOAuthBearer(): boolean {
  return !getStaticBearerFromEnv();
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

  if (res.status === 401) {
    throw new ModoPctError('No autorizado ante MODO (401)', 401, modoErr, payload);
  }
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

  if (res.status === 401) {
    throw new ModoPctError('No autorizado ante MODO (401)', 401, modoErr, payload);
  }
  if (res.status === 400) {
    throw new ModoPctError('Solicitud inválida al consultar pago (MODO 400)', 400, modoErr, payload);
  }
  if (res.status === 500) {
    throw new ModoPctError('Error del servicio MODO al consultar pago (500)', 502, modoErr, payload);
  }

  throw new ModoPctError(`Respuesta inesperada de MODO (${res.status})`, res.status >= 500 ? 502 : 400, modoErr, payload);
}

/** Crea pago PCT resolviendo config (OAuth si hace falta) y reintenta una vez tras 401 si el token era OAuth cacheado. */
export async function createModoPaymentWithConfigRefresh(
  body: ModoCreatePaymentBody,
): Promise<ModoCreatePaymentResponse> {
  const run = async () => createModoPayment(body, await getModoPctConfigAsync());
  try {
    return await run();
  } catch (e) {
    if (e instanceof ModoPctError && e.statusCode === 401 && modoPctUsesOAuthBearer()) {
      invalidateModoTokenCache();
      return await run();
    }
    throw e;
  }
}

/** GET estado con la misma lógica de token y reintento en 401. */
export async function getModoPaymentStatusWithConfigRefresh(trxId: string): Promise<ModoStatus> {
  const run = async () => getModoPaymentStatus(trxId, await getModoPctConfigAsync());
  try {
    return await run();
  } catch (e) {
    if (e instanceof ModoPctError && e.statusCode === 401 && modoPctUsesOAuthBearer()) {
      invalidateModoTokenCache();
      return await run();
    }
    throw e;
  }
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
export function verifyModoWebhookSecret(headers: ModoWebhookRequestHeaders): boolean {
  const expected = trimEnv('MODO_WEBHOOK_SECRET');
  if (!expected) return true;
  const got =
    (headers['x-modo-signature'] as string) ||
    (headers['x-webhook-secret'] as string) ||
    (headers['authorization'] as string)?.replace(/^Bearer\s+/i, '') ||
    '';
  return got === expected;
}
