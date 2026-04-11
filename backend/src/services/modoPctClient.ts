/**
 * Cliente HTTP para PCT Online (MODO) según modo-pct-api.json.
 * Requiere: MODO_BASE_URL (o MODO_PCP_BASE_URL), MODO_CLIENT_ID, MODO_CLIENT_SECRET.
 * Bearer: si MODO_BEARER_TOKEN está vacío, OAuth2 client_credentials contra MODO_TOKEN_URL o el default según NODE_ENV (Sandbox vs producción).
 * Las rutas públicas incluyen el segmento /backend antes de /v1|/v2 (p. ej. …/backend/v1/auth/token).
 * MODO_BASE_URL: prefijo hasta /pcp/{bcra_id} sin "/payment"; si no está definido: development o producción según NODE_ENV (host de pruebas: development.api.modo.com.ar).
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

export type PendingModoCheckout = {
  orderIds: string[];
  slug: string;
  createdAt: number;
};

const pendingModoByTrx = new Map<string, PendingModoCheckout>();
const webhookApprovedTrxs = new Set<string>();

export function registerPendingModoCheckout(
  trxId: string,
  meta: { orderIds: string[]; slug: string },
): void {
  pendingModoByTrx.set(trxId, { ...meta, createdAt: Date.now() });
}

export function getPendingModoCheckout(trxId: string): PendingModoCheckout | undefined {
  return pendingModoByTrx.get(trxId);
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
 * Host de desarrollo / pruebas (documentación MODO Conexiones). No usar sandbox.api.modo.com.ar:
 * no resuelve en DNS público (ENOTFOUND en Railway, etc.).
 */
export const MODO_DEVELOPMENT_API_HOST = 'development.api.modo.com.ar';

/** Alias obsoleto: redirige a development.api.modo.com.ar (misma ruta). */
const MODO_LEGACY_SANDBOX_HOST = 'sandbox.api.modo.com.ar';

function normalizeModoApiHostname(hostname: string): string {
  if (hostname.toLowerCase() === MODO_LEGACY_SANDBOX_HOST) return MODO_DEVELOPMENT_API_HOST;
  return hostname;
}

function defaultPcpBcraId(): string {
  const b = trimEnv('MODO_PCP_BCRA_ID');
  return b && /^\d+$/.test(b) ? b : '999';
}

/** No producción — token OAuth (host development, path /backend/v1). */
export const MODO_SANDBOX_TOKEN_URL = `https://${MODO_DEVELOPMENT_API_HOST}/backend/v1/auth/token`;

/** Producción — token OAuth (incluye /backend/v1). */
export const MODO_PRODUCTION_TOKEN_URL = 'https://api.modo.com.ar/backend/v1/auth/token';

/** No producción — base PCP hasta /pcp/{bcra_id} sin "/payment". */
export const MODO_SANDBOX_PCP_BASE_URL = `https://${MODO_DEVELOPMENT_API_HOST}/backend/v1/connections/pcp/999`;

/** Producción — base PCP hasta /pcp/{bcra_id} sin "/payment". */
export const MODO_PRODUCTION_PCP_BASE_URL = 'https://api.modo.com.ar/backend/v1/connections/pcp/999';

/**
 * Default de token según NODE_ENV (production → API prod; cualquier otro → Sandbox).
 * MODO_TOKEN_URL en .env tiene prioridad (se normaliza si falta /backend/).
 */
export const MODO_DEFAULT_TOKEN_URL = MODO_SANDBOX_TOKEN_URL;

/** Default PCP cuando no hay MODO_BASE_URL / MODO_PCP_BASE_URL (misma regla que token). */
export const MODO_DEFAULT_PCP_BASE_URL = MODO_SANDBOX_PCP_BASE_URL;

function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Enmascara client_id para logs (no exponer secret). */
function maskClientId(id: string): string {
  const t = id.trim();
  if (!t) return '(vacío)';
  if (t.length <= 6) return `(len=${t.length})`;
  return `${t.slice(0, 4)}…${t.slice(-2)} (len=${t.length})`;
}

/**
 * Corrige URLs de auth en host *.modo.com.ar si vinieron sin /backend/… (404 típico).
 * Ej.: …/v1/auth/token → …/backend/v1/auth/token
 */
export function ensureModoAuthUrlHasBackend(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    if (!/\.modo\.com\.ar$/i.test(u.hostname)) return trimmed;
    u.hostname = normalizeModoApiHostname(u.hostname);
    let p = u.pathname.replace(/\/+$/, '') || '/';
    if (p.includes('/backend/')) return u.toString().replace(/\/+$/, '');
    const m = p.match(/^\/(v\d+)\/(auth\/token)$/i);
    if (m) {
      u.pathname = `/backend/${m[1]}/${m[2]}`;
      return u.toString().replace(/\/+$/, '');
    }
    return u.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

/**
 * Corrige base PCP si falta /backend/v1 antes de /connections/… (URLs legacy).
 * No retorna solo por contener "/backend/": …/backend sin /connections/pcp sigue incompleto.
 */
export function ensureModoPcpBaseUrlHasBackend(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    if (!/\.modo\.com\.ar$/i.test(u.hostname)) return trimmed;
    u.hostname = normalizeModoApiHostname(u.hostname);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const hasFullPcpBase = p.includes('/backend/') && /\/pcp\/[^/]+$/i.test(p);
    if (hasFullPcpBase) return u.toString().replace(/\/+$/, '');
    if (!p.includes('/backend/')) {
      if (/^\/connections\//i.test(p)) {
        u.pathname = '/backend/v1' + p;
        return u.toString().replace(/\/+$/, '');
      }
      const vm = p.match(/^\/(v\d+)\/(connections\/.*)$/i);
      if (vm) {
        u.pathname = '/backend/' + vm[1] + '/' + vm[2];
        return u.toString().replace(/\/+$/, '');
      }
    }
    return u.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

/**
 * Completa bases truncadas (p. ej. …/backend o …/backend/v1) hasta …/backend/v1/connections/pcp/{bcra}.
 * bcra por MODO_PCP_BCRA_ID o 999.
 */
export function expandIncompleteModoPcpBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    if (!/\.modo\.com\.ar$/i.test(u.hostname)) return trimmed;
    u.hostname = normalizeModoApiHostname(u.hostname);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (/\/pcp\/[^/]+$/i.test(p) && p.includes('/backend/')) {
      return u.toString().replace(/\/+$/, '');
    }
    const bcra = defaultPcpBcraId();
    if (
      p === '/backend' ||
      p === '/backend/v1' ||
      p === '/backend/v1/connections' ||
      (p.includes('/backend/') && !/\/pcp\/[^/]+$/i.test(p))
    ) {
      u.pathname = `/backend/v1/connections/pcp/${bcra}`;
      return u.toString().replace(/\/+$/, '');
    }
    return u.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

function modoAuthTokenUrl(): string {
  const override = trimEnv('MODO_TOKEN_URL');
  if (override) return ensureModoAuthUrlHasBackend(override.replace(/\/+$/, ''));
  return ensureModoAuthUrlHasBackend(
    isProductionNodeEnv() ? MODO_PRODUCTION_TOKEN_URL : MODO_SANDBOX_TOKEN_URL,
  );
}

function modoDefaultPcpBaseUrl(): string {
  return isProductionNodeEnv() ? MODO_PRODUCTION_PCP_BASE_URL : MODO_SANDBOX_PCP_BASE_URL;
}

/** Lista variables de entorno obligatorias (sin contar el bearer: se obtiene por OAuth si no está en .env). Base PCP y token tienen defaults en código. */
export function getModoPctEnvMissingKeys(): string[] {
  const missing: string[] = [];
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
 * POST token (client_credentials). No usa caché.
 * URL: MODO_TOKEN_URL o default Sandbox/producción (NODE_ENV) con path …/backend/v1/auth/token.
 * Body: grant_type, client_id, client_secret (JSON o form; reintentos con headers X-Client-*).
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

function modoAuthErrorFromResponse(
  res: Response,
  data: Record<string, unknown>,
  rawText: string,
): ModoPctError {
  const modoLine =
    (typeof data.message === 'string' && data.message.trim()) ||
    (typeof data.error_description === 'string' && data.error_description) ||
    (typeof data.error === 'string' && data.error) ||
    res.statusText;
  const extra =
    typeof data.status_code === 'number' && data.status_code !== res.status
      ? `; MODO status_code=${data.status_code}`
      : '';
  const userText = `Auth MODO falló (HTTP ${res.status})${extra}: ${modoLine}`;
  const details: Record<string, unknown> = {
    ...data,
    _modoHttpStatus: res.status,
    _rawResponse: rawText,
  };
  const clientStatus = res.status >= 500 ? 502 : res.status;
  return new ModoPctError(userText, clientStatus, modoLine, details);
}

/** Reintentar con otro formato si el servidor no reconoce credenciales en el body (401/400/415/406). */
const MODO_AUTH_RETRY_STATUSES = new Set([401, 400, 415, 406]);

type ModoTokenStrategiesResult =
  | { success: true; token: string; expiresInSec: number }
  | { success: false; res: Response; data: Record<string, unknown>; rawText: string };

/**
 * Varias formas de enviar client_credentials (JSON, form, o client_id/secret en headers como en modo-pct-api).
 */
function isModoTokenFail(
  r: ModoTokenStrategiesResult,
): r is Extract<ModoTokenStrategiesResult, { success: false }> {
  return r.success === false;
}

async function tryModoTokenStrategiesAtUrl(
  url: string,
  clientId: string,
  clientSecret: string,
): Promise<ModoTokenStrategiesResult> {
  const strategies: { label: string; headers: Record<string, string>; body: string }[] = [
    {
      label: 'JSON body (grant_type + client_id + client_secret) + X-Client-Id / X-Client-Secret',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
    {
      label: 'application/x-www-form-urlencoded + X-Client-Id / X-Client-Secret',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    },
    {
      label: 'headers client_id + client_secret (como PCT) + JSON solo grant_type + X-Client-*',
      headers: {
        'Content-Type': 'application/json',
        client_id: clientId,
        client_secret: clientSecret,
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    },
    {
      label: 'headers client_id + client_secret + form solo grant_type + X-Client-*',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        client_id: clientId,
        client_secret: clientSecret,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    },
  ];

  let last: { res: Response; data: Record<string, unknown>; text: string } | null = null;

  console.log(
    `[MODO Auth] Inicio OAuth client_credentials · URL completa: ${url} · NODE_ENV=${String(process.env.NODE_ENV)} · client_id=${maskClientId(clientId)} · client_secret=(no logueado)`,
  );

  for (const s of strategies) {
    const headers: Record<string, string> = {
      'X-Client-Id': clientId,
      'X-Client-Secret': clientSecret,
      ...s.headers,
    };
    console.log(`[MODO Auth] Intento · URL: ${url} · estrategia: ${s.label}`);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: s.body,
        signal: AbortSignal.timeout(MODO_AUTH_FETCH_TIMEOUT_MS),
      });
    } catch (netErr: unknown) {
      console.error(`[MODO Auth] excepción (${s.label}):`, netErr);
      const name = netErr instanceof Error ? netErr.name : '';
      if (name === 'AbortError' || name === 'TimeoutError') {
        throw new ModoPctError(
          'Auth MODO: timeout esperando respuesta del token (10s)',
          504,
          undefined,
          netErr,
        );
      }
      const cause =
        netErr instanceof Error && 'cause' in netErr ? (netErr as Error & { cause?: { code?: string; hostname?: string } }).cause : undefined;
      if (cause && typeof cause === 'object' && cause.code === 'ENOTFOUND') {
        throw new ModoPctError(
          `Auth MODO: DNS ENOTFOUND para el host del token (${String(cause.hostname ?? 'n/a')}). Revisá MODO_TOKEN_URL: no uses sandbox.api.modo.com.ar (no existe en DNS); usá ${MODO_DEVELOPMENT_API_HOST} o api.modo.com.ar.`,
          502,
          undefined,
          netErr,
        );
      }
      throw new ModoPctError('Auth MODO: error de red al contactar el endpoint de token', 502, undefined, netErr);
    }

    const text = await res.text();
    const data = (await parseJsonSafe(text)) as Record<string, unknown>;
    last = { res, data, text };

    if (!res.ok) {
      console.error('Cuerpo del error de MODO:', text);
      if (!MODO_AUTH_RETRY_STATUSES.has(res.status)) {
        break;
      }
      continue;
    }

    try {
      const parsed = parseModoTokenFromPayload(data);
      return { success: true as const, token: parsed.token, expiresInSec: parsed.expiresInSec };
    } catch {
      console.error(`[MODO Auth] HTTP 200 pero sin access_token (${s.label}):`, text);
      break;
    }
  }

  if (!last) {
    throw new ModoPctError('Auth MODO: sin respuesta del servidor', 503);
  }
  return { success: false as const, res: last.res, data: last.data, rawText: last.text };
}

async function postModoAuthTokenRequest(
  clientId: string,
  clientSecret: string,
): Promise<{ token: string; expiresInSec: number }> {
  const url = modoAuthTokenUrl();
  const r = await tryModoTokenStrategiesAtUrl(url, clientId, clientSecret);
  if (isModoTokenFail(r)) {
    throw modoAuthErrorFromResponse(r.res, r.data, r.rawText);
  }
  return { token: r.token, expiresInSec: r.expiresInSec };
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

  const rawBase =
    trimEnv('MODO_PCP_BASE_URL') ||
    trimEnv('MODO_BASE_URL') ||
    modoDefaultPcpBaseUrl();
  const base = expandIncompleteModoPcpBaseUrl(ensureModoPcpBaseUrlHasBackend(rawBase)).replace(
    /\/+$/,
    '',
  );
  const clientId = trimEnv('MODO_CLIENT_ID');
  const clientSecret = trimEnv('MODO_CLIENT_SECRET');

  const tokenUrlResolved = modoAuthTokenUrl();
  console.log(
    `[MODO PCP config] NODE_ENV=${String(process.env.NODE_ENV)} · pcpBaseUrl=${base} · tokenUrl=${tokenUrlResolved} · client_id=${maskClientId(clientId)}`,
  );

  const bearerToken = await getModoAccessTokenCached(clientId, clientSecret);

  return {
    pcpBaseUrl: base,
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
    'X-Client-Id': config.clientId,
    'X-Client-Secret': config.clientSecret,
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

function modoResponseDetails(res: Response, text: string, payload: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    payload && typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : { parsed: payload };
  base._modoHttpStatus = res.status;
  base._rawResponse = text;
  return base;
}

/**
 * POST /pcp/{bcra_id}/payment — crea el pago. 201 + CreatePaymentResponse.
 */
export async function createModoPayment(
  body: ModoCreatePaymentBody,
  config: ModoPctConfig,
): Promise<ModoCreatePaymentResponse> {
  const url = `${config.pcpBaseUrl}/payment`;
  console.log(
    `[MODO PCP] POST crear pago · URL completa: ${url} · client_id=${maskClientId(config.clientId)} · client_secret=(no logueado)`,
  );
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
  const details = modoResponseDetails(res, text, payload);

  if (res.status === 201) {
    return (payload ?? {}) as ModoCreatePaymentResponse;
  }

  const modoErr = extractModoError(payload) ?? res.statusText;

  if (res.status === 401) {
    throw new ModoPctError('No autorizado ante MODO (401)', 401, modoErr, details);
  }
  if (res.status === 400) {
    throw new ModoPctError('Datos inválidos o token inválido/expirado (MODO 400)', 400, modoErr, details);
  }
  if (res.status === 500) {
    throw new ModoPctError('Error realizando el pago en MODO (500)', 502, modoErr, details);
  }

  throw new ModoPctError(
    `Respuesta inesperada de MODO (${res.status})`,
    res.status >= 500 ? 502 : res.status >= 400 ? res.status : 400,
    modoErr,
    details,
  );
}

/**
 * GET /pcp/{bcra_id}/payment/{trx_id} — estado del pago.
 */
export async function getModoPaymentStatus(trxId: string, config: ModoPctConfig): Promise<ModoStatus> {
  const id = encodeURIComponent(String(trxId).trim());
  const url = `${config.pcpBaseUrl}/payment/${id}`;
  console.log(
    `[MODO PCP] GET estado pago · URL completa: ${url} · client_id=${maskClientId(config.clientId)} · client_secret=(no logueado)`,
  );
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
  const details = modoResponseDetails(res, text, payload);

  if (res.status === 200) {
    return (payload ?? {}) as ModoStatus;
  }

  const modoErr = extractModoError(payload) ?? res.statusText;

  if (res.status === 401) {
    throw new ModoPctError('No autorizado ante MODO (401)', 401, modoErr, details);
  }
  if (res.status === 400) {
    throw new ModoPctError('Solicitud inválida al consultar pago (MODO 400)', 400, modoErr, details);
  }
  if (res.status === 500) {
    throw new ModoPctError('Error del servicio MODO al consultar pago (500)', 502, modoErr, details);
  }

  throw new ModoPctError(
    `Respuesta inesperada de MODO (${res.status})`,
    res.status >= 500 ? 502 : res.status >= 400 ? res.status : 400,
    modoErr,
    details,
  );
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
