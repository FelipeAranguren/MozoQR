import { api } from '../api';
import type {
  CashMovement,
  CashSession,
  CreateCashMovementPayload,
  CreateCashSessionPayload,
  OwnerCompraPayload,
  StockItem,
  StockMovement,
  StrapiEntityId,
  UpdateCashSessionPayload,
  UpdateStockItemPayload,
} from '../types/cashAndStock';

function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Ruta REST de sesiones de caja (`api::caja.caja`, pluralName `cash-sessions`). */
export const CASH_SESSIONS_PATH = '/cash-sessions';
export const CASH_MOVEMENTS_PATH = '/cash-movements';
export const STOCK_ITEMS_PATH = '/stock-items';
export const STOCK_MOVEMENTS_PATH = '/stock-movements';

const POPULATE_ALL = { populate: '*' as const };

/**
 * Normaliza un documento Strapi (v5 plano o envoltorio con `attributes`).
 */
export function normalizeEntry<T extends Record<string, unknown>>(row: unknown): T | null {
  if (row == null || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (r.attributes && typeof r.attributes === 'object') {
    return { id: r.id, documentId: r.documentId, ...(r.attributes as object) } as T;
  }
  return { ...r } as T;
}

/** Cuerpo JSON de Strapi (`{ data, meta }`) ya sea el de axios o el interno. */
export function normalizeList<T>(apiBody: unknown): T[] {
  const body = apiBody as { data?: unknown };
  const raw = body?.data;
  if (Array.isArray(raw)) {
    return raw.map((row) => normalizeEntry<T>(row)).filter(Boolean) as T[];
  }
  if (raw != null && typeof raw === 'object') {
    const one = normalizeEntry<T>(raw);
    return one ? [one] : [];
  }
  return [];
}

export function normalizeOne<T>(apiBody: unknown): T | null {
  const body = apiBody as { data?: unknown };
  const raw = body?.data;
  if (raw == null) return null;
  if (Array.isArray(raw)) return normalizeEntry<T>(raw[0]);
  return normalizeEntry<T>(raw);
}

function unwrapRelation<T>(rel: unknown): T | T[] | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) {
    return rel.map((x) => normalizeEntry(x)).filter(Boolean) as T[];
  }
  const obj = rel as Record<string, unknown>;
  if (obj.data !== undefined) {
    const d = obj.data;
    if (Array.isArray(d)) return d.map((x) => normalizeEntry<T>(x)).filter(Boolean) as T[];
    return normalizeEntry<T>(d);
  }
  return normalizeEntry<T>(rel);
}

/** ID estable para PUT/DELETE en Strapi 5 (prioriza `documentId`). */
export function restEntityId(entity: { id?: StrapiEntityId; documentId?: string } | null | undefined): string | number {
  if (!entity) throw new Error('Entidad sin id');
  const doc = entity.documentId;
  if (doc != null && doc !== '') return doc;
  if (entity.id != null) return entity.id;
  throw new Error('Entidad sin id ni documentId');
}

function restaurantFilter(restaurantId: number | string, keyPrefix: string) {
  const idStr = String(restaurantId);
  if (typeof restaurantId === 'number' || /^\d+$/.test(idStr)) {
    return { [`${keyPrefix}[id][$eq]`]: Number(restaurantId) };
  }
  return { [`${keyPrefix}[documentId][$eq]`]: idStr };
}

// ——— Cash sessions (caja) ———

export async function fetchOpenCashSession(
  restaurantId: number | string
): Promise<CashSession | null> {
  const filters = {
    ...restaurantFilter(restaurantId, 'filters[restaurante]'),
    'filters[estado][$eq]': 'abierta',
    ...POPULATE_ALL,
    'sort[0]': 'fecha_apertura:desc',
  };
  const res = await api.get(CASH_SESSIONS_PATH, { params: filters, headers: getAuthHeaders() });
  const list = normalizeList<CashSession>(res.data);
  return list[0] ?? null;
}

export async function createCashSession(payload: CreateCashSessionPayload): Promise<CashSession | null> {
  const body = {
    data: {
      ...payload,
      publishedAt: new Date().toISOString(),
    },
  };
  const res = await api.post(CASH_SESSIONS_PATH, body, {
    params: POPULATE_ALL,
    headers: getAuthHeaders(),
  });
  return normalizeOne<CashSession>(res.data);
}

export async function updateCashSession(
  sessionId: string | number,
  payload: UpdateCashSessionPayload
): Promise<CashSession | null> {
  const body = {
    data: {
      ...payload,
      publishedAt: new Date().toISOString(),
    },
  };
  const res = await api.put(`${CASH_SESSIONS_PATH}/${sessionId}`, body, {
    params: POPULATE_ALL,
    headers: getAuthHeaders(),
  });
  return normalizeOne<CashSession>(res.data);
}

/** Sesiones cerradas (historial), opcional filtro por rango de fecha_cierre (YYYY-MM-DD). */
export async function fetchClosedCashSessions(
  restaurantId: number | string,
  opts: { desde?: string; hasta?: string; page?: number; pageSize?: number } = {}
): Promise<CashSession[]> {
  const { desde, hasta, page = 1, pageSize = 50 } = opts;
  const params: Record<string, string | number> = {
    ...restaurantFilter(restaurantId, 'filters[restaurante]'),
    'filters[estado][$eq]': 'cerrada',
    ...POPULATE_ALL,
    'sort[0]': 'fecha_cierre:desc',
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
  };
  if (desde) params['filters[fecha_cierre][$gte]'] = `${desde}T00:00:00.000Z`;
  if (hasta) params['filters[fecha_cierre][$lte]'] = `${hasta}T23:59:59.999Z`;
  const res = await api.get(CASH_SESSIONS_PATH, { params, headers: getAuthHeaders() });
  return normalizeList<CashSession>(res.data);
}

// ——— Cash movements ———

export async function fetchCashMovementsForSession(sessionId: string | number): Promise<CashMovement[]> {
  const sid = String(sessionId);
  const params: Record<string, string | number> = {
    ...POPULATE_ALL,
    'sort[0]': 'createdAt:desc',
  };
  if (/^\d+$/.test(sid)) {
    params['filters[cash_session][id][$eq]'] = Number(sid);
  } else {
    params['filters[cash_session][documentId][$eq]'] = sid;
  }
  const res = await api.get(CASH_MOVEMENTS_PATH, { params, headers: getAuthHeaders() });
  return normalizeList<CashMovement>(res.data);
}

export async function createCashMovement(payload: CreateCashMovementPayload): Promise<CashMovement | null> {
  const body = {
    data: {
      tipo: payload.tipo,
      monto: payload.monto,
      concepto: payload.concepto ?? '',
      cash_session: payload.cash_session,
      publishedAt: new Date().toISOString(),
    },
  };
  const res = await api.post(CASH_MOVEMENTS_PATH, body, {
    params: POPULATE_ALL,
    headers: getAuthHeaders(),
  });
  return normalizeOne<CashMovement>(res.data);
}

/** Balance = monto_inicial + ingresos − egresos (movimientos de la sesión). */
export function computeCashBalance(session: CashSession | null, movements: CashMovement[]): number {
  const initial = Number(session?.monto_inicial ?? 0);
  const delta = movements.reduce((acc, m) => {
    const amt = Number(m.monto ?? 0);
    if (m.tipo === 'egreso') return acc - amt;
    return acc + amt;
  }, 0);
  return initial + delta;
}

/** Movimientos embebidos en la sesión si vinieron con `populate=*`. */
export function cashMovementsFromSession(session: CashSession | null): CashMovement[] {
  if (!session?.cash_movements) return [];
  const un = unwrapRelation<CashMovement>(session.cash_movements as unknown);
  if (!un) return [];
  return Array.isArray(un) ? un : [un];
}

// ——— Stock items ———

export async function fetchStockItemsForRestaurant(restaurantId: number | string): Promise<StockItem[]> {
  const params = {
    ...restaurantFilter(restaurantId, 'filters[producto][restaurante]'),
    ...POPULATE_ALL,
    'sort[0]': 'nombre:asc',
  };
  const res = await api.get(STOCK_ITEMS_PATH, { params, headers: getAuthHeaders() });
  return normalizeList<StockItem>(res.data);
}

export async function updateStockItemEstado(
  itemId: string | number,
  body: UpdateStockItemPayload
): Promise<StockItem | null> {
  const payload = { data: { estado: body.estado } };
  const res = await api.put(`${STOCK_ITEMS_PATH}/${itemId}`, payload, {
    params: POPULATE_ALL,
    headers: getAuthHeaders(),
  });
  return normalizeOne<StockItem>(res.data);
}

// ——— Stock movements ———

export async function fetchStockMovementsForRestaurant(
  restaurantId: number | string
): Promise<StockMovement[]> {
  const params = {
    ...restaurantFilter(restaurantId, 'filters[stock_item][producto][restaurante]'),
    ...POPULATE_ALL,
    'sort[0]': 'createdAt:desc',
  };
  const res = await api.get(STOCK_MOVEMENTS_PATH, { params, headers: getAuthHeaders() });
  return normalizeList<StockMovement>(res.data);
}

/**
 * Crea una compra pendiente vía **ruta custom** del backend (no es REST de una colección):
 * `POST /api/restaurants/:slug/compras` → `compra` + `item-compra` con relación **`stock_item`**.
 * Los movimientos `stock-movements` se generan al **recibir** la compra (`PUT .../recibir`).
 */
export async function crearCompraOwner(slug: string, payload: OwnerCompraPayload): Promise<unknown> {
  const res = await api.post(`/restaurants/${slug}/compras`, payload, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  });
  const body = res.data as { data?: unknown };
  return body?.data ?? body;
}
