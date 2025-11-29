/**
 * Custom tenant controller
 * Endpoints:
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 */
import { errors } from '@strapi/utils';
type ID = number | string;

const { ValidationError, NotFoundError } = errors;

type Ctx = {
  params?: Record<string, any>;
  request: { body: any };
  body?: any;
  forbidden?: (message?: string) => void;
  badRequest?: (message?: string) => void;
  unauthorized?: (message?: string) => void;
  notFound?: (message?: string) => void;
};

function getPayload(raw: any) {
  // Acepta { data: {...} } o {...}
  return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}

/* -------------------------------------------------------
 * Helpers (REST-safe: usamos ids planos)
 * ----------------------------------------------------- */

/** Busca restaurante por slug y devuelve { id, name } */
async function getRestaurantBySlug(slug: string) {
  const rows = await strapi.entityService.findMany('api::restaurante.restaurante', {
    filters: { slug },
    fields: ['id', 'name'],
    limit: 1,
  });
  const r: any = rows?.[0];
  if (!r?.id) throw new NotFoundError('Restaurante no encontrado');
  return { id: r.id as ID, name: r.name as string };
}

/**
 * Devuelve la Mesa existente (por restaurante + number).
 * Ya no crea mesas automáticamente: si no existe, lanza ValidationError.
 */
async function getOrCreateMesa(restauranteId: ID, number: number) {
  const found = await strapi.entityService.findMany('api::mesa.mesa', {
    filters: { restaurante: { id: Number(restauranteId) }, number },
    fields: ['id', 'number'],
    limit: 1,
  });

  const mesa = found?.[0];
  if (!mesa?.id) {
    throw new ValidationError(`Mesa ${number} no existe para este restaurante`);
  }

  return mesa;
}

/**
 * Devuelve la sesión ABIERTA para esa mesa.
 * Estrategia: primero buscar una 'open' por (restaurante, mesa).
 * Si no hay, crear una nueva (code autogenerado).
 * Ignoramos 'code' para reutilizar por robustez (evita “primer pedido sin sesión”).
 */
async function getOrCreateOpenSession(opts: {
  restauranteId: ID;
  mesaId: ID;
}) {
  const { restauranteId, mesaId } = opts;

  // 1) Buscar sesión abierta existente (única por mesa)
  const existingOpen = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
    filters: {
      restaurante: { id: Number(restauranteId) },
      mesa: { id: Number(mesaId) },
      session_status: 'open',
    },
    fields: ['id', 'code', 'session_status', 'openedAt'],
    sort: ['openedAt:desc', 'createdAt:desc'],
    limit: 1,
  });
  if (existingOpen?.[0]?.id) return existingOpen[0];

  // 2) Crear una nueva
  const newCode = Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36).slice(-4);

  return await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
  data: {
    code: newCode,
    session_status: 'open',
    openedAt: new Date(),
    restaurante: { id: Number(restauranteId) }, // <= así
    mesa: { id: Number(mesaId) },               // <= así
    publishedAt: new Date(),
  },
});
}

/** Crea los ítems de un pedido (ids planos) */
async function createItems(pedidoId: ID, items: any[]) {
  await Promise.all(
    (items || []).map((it) => {
      const quantity = Number(it?.qty ?? it?.quantity ?? 0);
      const unitPrice = Number(it?.unitPrice ?? it?.price ?? 0);
      const total = Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0;
      const rawProductId = it?.productId ?? it?.id;
      const productId =
        rawProductId !== undefined &&
        rawProductId !== null &&
        typeof rawProductId === 'string' &&
        /^\d+$/.test(rawProductId)
          ? Number(rawProductId)
          : typeof rawProductId === 'number'
          ? rawProductId
          : null;

      return strapi.entityService.create('api::item-pedido.item-pedido', {
        data: {
          quantity,
          notes: it?.notes || '',
          UnitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
          totalPrice: total,
          order: pedidoId,
          ...(productId ? { product: productId } : {}),
          publishedAt: new Date(),
        },
      });
    })
  );
}

/* -------------------------------------------------------
 * Controller
 * ----------------------------------------------------- */

export default {
  /**
   * POST /restaurants/:slug/orders
   * Body esperado: { table: number, items: [...], total?: number, customerNotes?: string }
   */
  async createOrder(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing restaurant slug');

    const data = getPayload(ctx.request.body);
    const table = data?.table;
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    const customerNotes: string = data?.customerNotes ?? data?.notes ?? '';

    if (table === undefined || table === null || table === '') {
      throw new ValidationError('Missing table');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Empty items');
    }

    // Restaurante
    const restaurante = await getRestaurantBySlug(String(slug));

    // Mesa & Sesión (única sesión "open" por mesa)
    const mesa = await getOrCreateMesa(restaurante.id, Number(table));
    const sesion = await getOrCreateOpenSession({
      restauranteId: restaurante.id,
      mesaId: mesa.id,
    });

    // Total (del cliente o calculado)
    const total =
      data?.total !== undefined && data?.total !== null && data?.total !== ''
        ? Number(data.total)
        : items.reduce((s, it) => {
            const q = Number(it?.qty ?? it?.quantity ?? 0);
            const p = Number(it?.unitPrice ?? it?.price ?? 0);
            const line = q * p;
            return s + (Number.isFinite(line) ? line : 0);
          }, 0);

    // Crear pedido vinculado a la sesión (usar objeto { id } para la relación)
    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        order_status: 'pending',
        customerNotes,
        total,
        restaurante: { id: Number(restaurante.id) },
        mesa_sesion: { id: Number(sesion.id) },
        publishedAt: new Date(),
      },
    });

    // Ítems
    await createItems(pedido.id, items);

    ctx.body = { data: { id: pedido.id } };
  },

  /**
   * POST|PUT /restaurants/:slug/close-account
   * Body: { table: number }
   * Marca como 'paid' los pedidos de la sesión abierta para esa mesa
   * y cierra la sesión. Limpia mesa.currentSession (si lo usás).
   */
  async closeAccount(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing restaurant slug');

    const data = getPayload(ctx.request.body);
    const table = data?.table;

    if (table === undefined || table === null || table === '') {
      throw new ValidationError('Missing table');
    }

    // Restaurante, mesa y sesión abierta actual
    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getOrCreateMesa(restaurante.id, Number(table));

    const openList = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
      filters: {
        restaurante: { id: Number(restaurante.id) },
        mesa: { id: Number(mesa.id) },
        session_status: 'open',
      },
      fields: ['id'],
      sort: ['openedAt:desc', 'createdAt:desc'],
      limit: 1,
    });
    const sesion: any = openList?.[0] || null;

    if (!sesion?.id) {
      ctx.body = { data: { paidOrders: 0 } };
      return;
    }

    // Pedidos NO pagados de esa sesión
    const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: { mesa_sesion: { id: Number(sesion.id) }, order_status: { $ne: 'paid' } },
      fields: ['id'],
      limit: 1000,
    });
    const ids = (pedidos || []).map((p: any) => p.id);

    await Promise.all(
      ids.map((id) =>
        strapi.entityService.update('api::pedido.pedido', id, {
          data: { order_status: 'paid' },
        })
      )
    );

    // Cerrar la sesión (marcar como 'paid' y poner closedAt)
    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
      data: { session_status: 'paid', closedAt: new Date() },
    });

    // Limpia la referencia de sesión actual en la mesa (si la usás)
    try {
      await strapi.entityService.update('api::mesa.mesa', mesa.id, {
        data: { currentSession: null },
      });
    } catch {
      // opcional: si no existe el campo, ignorar
    }

    ctx.body = { data: { paidOrders: ids.length } };
  },

  /**
   * POST /restaurants/:slug/open-session
   * Body: { table: number }
   * Abre una sesión de mesa (marca la mesa como ocupada) aunque no haya pedido todavía
   */
  async openSession(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing restaurant slug');

    const data = getPayload(ctx.request.body);
    const table = data?.table;

    if (table === undefined || table === null || table === '') {
      throw new ValidationError('Missing table');
    }

    // Restaurante
    const restaurante = await getRestaurantBySlug(String(slug));

    // Mesa (debe existir, no creamos automáticamente)
    const found = await strapi.entityService.findMany('api::mesa.mesa', {
      filters: { restaurante: { id: Number(restaurante.id) }, number: Number(table) },
      fields: ['id', 'number'],
      limit: 1,
    });
    if (!found?.[0]?.id) {
      throw new ValidationError(`Mesa ${table} no existe para este restaurante`);
    }
    const mesa = found[0];

    // Crear o reutilizar sesión abierta
    const sesion = await getOrCreateOpenSession({
      restauranteId: restaurante.id,
      mesaId: mesa.id,
    });

    ctx.body = { data: { sessionId: sesion.id, code: sesion.code } };
  },
};
