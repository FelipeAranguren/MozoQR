/**
 * Custom tenant controller
 * Endpoints:
 *  - POST /api/restaurants/:slug/orders
 *  - POST|PUT /api/restaurants/:slug/close-account
 *  - POST /api/restaurants/:slug/open-session
 *  - PUT /api/restaurants/:slug/close-session
 */
import { errors } from '@strapi/utils';
type ID = number | string;

const { ValidationError, NotFoundError } = errors;

declare var strapi: any;

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
  return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
}

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */

async function getRestaurantBySlug(slug: string) {
  const rows = await strapi.entityService.findMany('api::restaurante.restaurante', {
    filters: { slug },
    fields: ['id', 'documentId', 'name'],
    limit: 1,
  });
  const r: any = rows?.[0];
  if (!r?.id) throw new NotFoundError('Restaurante no encontrado');
  return { id: r.id as ID, documentId: r.documentId as string, name: r.name as string };
}

/**
 * Get Table strictly by Number. Throws if not found.
 */
async function getMesaOrThrow(restauranteId: ID, number: number) {
  const found = await strapi.entityService.findMany('api::mesa.mesa', {
    filters: { restaurante: { id: Number(restauranteId) }, number },
    fields: ['id', 'documentId', 'number', 'status'],
    limit: 1,
    publicationState: 'preview' // CRITICAL: Find even if Draft
  });

  const mesa = found?.[0];
  if (!mesa?.id) {
    throw new ValidationError(`Mesa ${number} no existe.`);
  }

  return mesa;
}

/**
 * Direct DB Update for Table Status (Bypasses Entity Service)
 */
async function setTableStatus(mesaId: ID, status: 'ocupada' | 'disponible' | 'por_limpiar', currentSessionId: ID | null = null) {
  // Using strapi.db.query to avoid Draft/Publish issues
  await strapi.db.query('api::mesa.mesa').update({
    where: { id: mesaId },
    data: {
      status,
      currentSession: currentSessionId,
      publishedAt: new Date() // Force publish
    }
  });
}

/**
 * Get active session or create new one.
 * Ensures strict State Management: If session is open, Table MUST be 'ocupada'.
 */
async function getOrCreateOpenSession(opts: {
  restauranteId: ID;
  mesaId: ID;
  mesaDocumentId: string;
  includePaid?: boolean;
}) {
  const { restauranteId, mesaId, mesaDocumentId, includePaid = false } = opts;

  // 1. Search for existing session
  const statusFilters: ('open' | 'paid')[] = ['open'];
  if (includePaid) statusFilters.push('paid');

  const existingSessions = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
    filters: {
      restaurante: { id: Number(restauranteId) },
      mesa: { id: Number(mesaId) },
      session_status: { $in: statusFilters },
    },
    fields: ['id', 'documentId', 'code', 'session_status', 'openedAt'],
    sort: ['openedAt:desc'],
    limit: 1,
    publicationState: 'preview'
  });

  if (existingSessions?.[0]?.id) {
    const session = existingSessions[0];
    const hoursDiff = (Date.now() - new Date(session.openedAt).getTime()) / (1000 * 60 * 60);

    // Auto-close old sessions (>24h)
    if (session.session_status === 'open' && hoursDiff > 24) {
      await strapi.entityService.update('api::mesa-sesion.mesa-sesion', session.documentId, {
        data: { session_status: 'closed', closedAt: new Date() },
      });
      // Fall through to create new
    } else {
      // Valid session found -> Ensure table is 'ocupada'
      await setTableStatus(mesaId, 'ocupada', session.id);
      return session;
    }
  }

  // 2. Create new session
  const newCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const newSession = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
    data: {
      code: newCode,
      session_status: 'open',
      openedAt: new Date(),
      restaurante: { id: Number(restauranteId) },
      mesa: { id: Number(mesaId) },
      publishedAt: new Date(),
    },
  });

  console.log(`[getOrCreateOpenSession] Created Session: ${newSession.id}`);

  // Mark table Occupied (Low Level)
  await setTableStatus(mesaId, 'ocupada', newSession.id);
  console.log(`[getOrCreateOpenSession] Updated Table ${mesaId} status to 'ocupada'`);

  return newSession;
}

export default {
  /**
   * POST /restaurants/:slug/orders
   */
  async createOrder(ctx: Ctx) {
    const { slug } = ctx.params || {};
    if (!slug) throw new ValidationError('Missing slug');

    const data = getPayload(ctx.request.body);
    const table = data?.table;
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    if (!table || items.length === 0) throw new ValidationError('Invalid data');

    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getMesaOrThrow(restaurante.id, Number(table));

    // Get/Create Session (implicitly sets table to 'ocupada')
    const sesion = await getOrCreateOpenSession({
      restauranteId: restaurante.id,
      mesaId: mesa.id,
      mesaDocumentId: mesa.documentId,
      includePaid: false,
    });

    // Create Order logic...
    const total = items.reduce((s, it) => {
      const q = Number(it?.qty ?? it?.quantity ?? 0);
      const p = Number(it?.unitPrice ?? it?.price ?? 0);
      return s + (q * p);
    }, 0);

    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        order_status: 'pending',
        customerNotes: data?.customerNotes || '',
        total,
        restaurante: { id: Number(restaurante.id) },
        mesa_sesion: { id: Number(sesion.id) },
        publishedAt: new Date(),
      },
    });

    // Create Items
    await Promise.all(items.map(it => {
      return strapi.entityService.create('api::item-pedido.item-pedido', {
        data: {
          quantity: it.quantity,
          notes: it.notes,
          UnitPrice: it.unitPrice,
          totalPrice: it.quantity * it.unitPrice,
          order: pedido.id,
          product: it.productId,
          publishedAt: new Date()
        }
      });
    }));

    ctx.body = { data: { id: pedido.id } };
  },

  /**
   * POST /restaurants/:slug/open-session
   */
  async openSession(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const data = getPayload(ctx.request.body);
    const table = data?.table;

    if (!table) throw new ValidationError('Missing table');

    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getMesaOrThrow(restaurante.id, Number(table));

    const sesion = await getOrCreateOpenSession({
      restauranteId: restaurante.id,
      mesaId: mesa.id,
      mesaDocumentId: mesa.documentId
    });

    ctx.body = { data: { sessionId: sesion.id, status: sesion.session_status } };
  },

  /**
   * PUT /restaurants/:slug/close-session
   * "Soft Close & Publish" Strategy
   */
  async closeSession(ctx: Ctx) {
    console.log('[closeSession] START');
    try {
      const { slug } = ctx.params || {};
      const data = getPayload(ctx.request.body);
      const table = data?.table;

      if (!table) throw new ValidationError('Missing table');

      // 1. Get Restaurant & Table
      console.log('[closeSession] Fetching Restaurant/Table...');
      const restaurante = await getRestaurantBySlug(String(slug));
      const mesa = await getMesaOrThrow(restaurante.id, Number(table));
      console.log(`[closeSession DB] Closing Table ${table} (ID: ${mesa.id} / DocID: ${mesa.documentId})`);

      // 2. Soft Close & Publish Sessions
      // FIX: "Shotgun" Query - Match by ID OR DocumentId to capture any relation format
      console.log(`[closeSession] Robust Query: mesa.id=${mesa.id} OR mesa.documentId=${mesa.documentId}`);

      const updateRes = await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
        where: {
          $or: [
            { mesa: { id: mesa.id } },
            { mesa: { documentId: mesa.documentId } }
          ],
          session_status: { $in: ['open', 'paid'] }
        },
        data: {
          session_status: 'closed',
          closedAt: new Date(),
          publishedAt: new Date()
        }
      });
      console.log(`[closeSession] updateMany result:`, updateRes);

      // 3. Update Table Status
      console.log('[closeSession] Updating Table Status to disponible...');
      await setTableStatus(mesa.id, 'disponible', null);
      console.log('[closeSession] Table Status Updated.');

      ctx.body = { data: { success: true, updated: updateRes?.count ?? 0 } };
    } catch (err: any) {
      console.error('[closeSession CRITICAL ERROR]', err);
      // Return 200 with error info to avoid generic 500 handling in browser
      ctx.body = {
        data: { success: false },
        error: `Backend Error: ${err.message}`,
        stack: err.stack
      };
    }
  },

  /**
   * POST /restaurants/:slug/close-account
   */
  async closeAccount(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const data = getPayload(ctx.request.body);
    const table = data?.table;

    if (!table) throw new ValidationError('Missing table');

    const restaurante = await getRestaurantBySlug(String(slug));
    const mesa = await getMesaOrThrow(restaurante.id, Number(table));

    // Find sessions (using Low Level to be safe)
    const sessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
      where: {
        mesa: mesa.id,
        session_status: { $in: ['open', 'paid'] }
      }
    });

    // Pay Orders & Close Sessions
    if (sessions.length > 0) {
      await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
        where: { id: { $in: sessions.map((s: any) => s.id) } },
        data: { session_status: 'paid', publishedAt: new Date() }
      });
    }

    // Mark table as 'por_limpiar'
    await setTableStatus(mesa.id, 'por_limpiar', null);

    ctx.body = { data: { success: true } };
  },

  // DEBUGGING TOOL
  async debugSession(ctx: Ctx) {
    const { id } = ctx.params || {};
    const tableNumber = Number(id);

    try {
      const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
        filters: { number: tableNumber },
        fields: ['id', 'documentId', 'status'],
        limit: 1,
        publicationState: 'preview'
      });
      const mesa = mesas[0];

      if (!mesa) {
        ctx.body = { error: 'Mesa not found' };
        return;
      }

      const results: Record<string, any> = {};

      results.strategyA = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
        where: { mesa: mesa.id },
        select: ['id', 'session_status', 'publishedAt']
      });

      ctx.body = { mesa, results };
    } catch (err: any) {
      ctx.body = { error: err.message };
    }
  },

  async resetTables(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const restaurante = await getRestaurantBySlug(String(slug));
    const restauranteId = Number(restaurante.id);

    // FIX: Use DB Query for deletion
    await strapi.db.query('api::mesa-sesion.mesa-sesion').deleteMany({
      where: { restaurante: restauranteId }
    });

    await strapi.db.query('api::mesa.mesa').deleteMany({
      where: { restaurante: restauranteId }
    });

    const created = [];
    for (let i = 1; i <= 20; i++) {
      const newMesa = await strapi.entityService.create('api::mesa.mesa', {
        data: {
          number: i,
          name: `Mesa ${i}`,
          status: 'disponible',
          restaurante: restauranteId,
          publishedAt: new Date(),
        }
      });
      created.push(newMesa.id);
    }

    ctx.body = { message: 'Reset done', count: created.length };
  }
};
