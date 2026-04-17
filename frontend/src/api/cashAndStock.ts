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
  OwnerProductoRow,
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
  if (Array.isArray(apiBody)) {
    return apiBody.map((row) => normalizeEntry<T>(row)).filter(Boolean) as T[];
  }
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

// ——— Productos (owner / compras) ———

/** Productos para “Nueva compra” usando slug (evita REST `/productos` vacío con JWT). */
export async function fetchProductosForCompraBySlug(slug: string): Promise<OwnerProductoRow[]> {
  if (!slug) return [];
  try {
    const res = await api.get(`/restaurants/${encodeURIComponent(slug)}/catalog-for-owner`, {
      headers: getAuthHeaders(),
    });
    const packs = (res.data as { data?: { products?: unknown } })?.data?.products ?? (res.data as any)?.products;
    if (!Array.isArray(packs)) return [];
    return packs
      .map((row) => normalizeEntry<OwnerProductoRow>(row as Record<string, unknown>))
      .filter((p) => p != null && (p.id != null || p.documentId != null)) as OwnerProductoRow[];
  } catch {
    return [];
  }
}

/** Todos los productos del restaurante (para elegir en “Nueva compra”, sin depender de que exista stock-item). */
export async function fetchProductosForCompra(restaurantId: number | string): Promise<OwnerProductoRow[]> {
  const params = new URLSearchParams();
  params.append('filters[restaurante][id][$eq]', String(restaurantId));
  params.append('pagination[page]', '1');
  params.append('pagination[pageSize]', '500');
  /** Owner: incluir borradores (Strapi solo devuelve “live” por defecto → lista vacía si nada está publicado). */
  params.append('publicationState', 'preview');
  params.append('fields[0]', 'name');
  params.append('fields[1]', 'sku');
  params.append('fields[2]', 'documentId');
  params.append('fields[3]', 'id');
  params.append('sort[0]', 'name:asc');
  const res = await api.get(`/productos?${params.toString()}`, { headers: getAuthHeaders() });
  return normalizeList<OwnerProductoRow>(res.data);
}

// ——— Stock items ———

export async function fetchStockItemsForRestaurant(restaurantId: number | string): Promise<StockItem[]> {
  const params = {
    ...restaurantFilter(restaurantId, 'filters[producto][restaurante]'),
    ...POPULATE_ALL,
    publicationState: 'preview',
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
    publicationState: 'preview',
    'sort[0]': 'createdAt:desc',
  };
  const res = await api.get(STOCK_MOVEMENTS_PATH, { params, headers: getAuthHeaders() });
  return normalizeList<StockMovement>(res.data);
}

function validationErrorAsAxios(message: string): Error {
  const err = new Error(message) as Error & { response?: { status: number; data: { error?: { message: string } } } };
  err.response = { status: 400, data: { error: { message } } };
  return err;
}

/**
 * Crea una compra vía **ruta custom**: `POST /api/restaurants/:slug/compras`.
 * Por defecto el backend **aplica inventario al crear** (`aplicar_inventario` omitido): suma cantidades al
 * stock-item / producto y marca la compra **recibida**. Enviá `aplicar_inventario: false` para dejarla
 * **pendiente** y aplicar stock solo con `PUT .../compras/:id/recibir`.
 */
export async function crearCompraOwner(slug: string, payload: OwnerCompraPayload): Promise<unknown> {
  const lines = payload?.items;
  if (!Array.isArray(lines) || lines.length === 0) {
    throw validationErrorAsAxios(
      'La compra debe incluir al menos una línea con producto, cantidad y costo.'
    );
  }
  for (let i = 0; i < lines.length; i += 1) {
    const L = lines[i];
    const pid = L?.productoId;
    const sid = L?.stockItemId;
    const hasProd = pid != null && String(pid).trim() !== '';
    const hasStock = sid != null && String(sid).trim() !== '';
    if (!hasProd && !hasStock) {
      throw validationErrorAsAxios(
        `Línea ${i + 1}: falta productoId (producto del restaurante) o stockItemId.`
      );
    }
    if (L.quantity == null || L.unit_cost == null) {
      throw validationErrorAsAxios(`Línea ${i + 1}: quantity y unit_cost son obligatorios.`);
    }
    const q = Number(L.quantity);
    const c = Number(L.unit_cost);
    if (!Number.isFinite(q) || q <= 0) {
      throw validationErrorAsAxios(`Línea ${i + 1}: la cantidad debe ser un número mayor que 0.`);
    }
    if (!Number.isFinite(c) || c < 0) {
      throw validationErrorAsAxios(`Línea ${i + 1}: el costo unitario debe ser un número mayor o igual a 0.`);
    }
  }

  const res = await api.post(`/restaurants/${slug}/compras`, payload, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  });
  const body = res.data as { data?: unknown };
  return body?.data ?? body;
}
