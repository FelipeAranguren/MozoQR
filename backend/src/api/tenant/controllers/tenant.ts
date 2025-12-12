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
 * Get Table strictly by Number. Creates it if not found (with duplicate protection).
 * Uses direct DB query to avoid entityService relation filter issues.
 * PROTECCIÓN CONTRA DUPLICADOS: Verifica antes de crear y maneja race conditions.
 */
async function getMesaOrThrow(restauranteId: ID, number: number) {
  const restauranteIdNum = Number(restauranteId);
  const numberNum = Number(number);

  // Validar parámetros
  if (!restauranteIdNum || isNaN(restauranteIdNum)) {
    throw new ValidationError(`ID de restaurante inválido: ${restauranteId}`);
  }
  if (!numberNum || isNaN(numberNum) || numberNum <= 0) {
    throw new ValidationError(`Número de mesa inválido: ${number}`);
  }

  // Use direct DB query for more reliable relation filtering (searches all, including unpublished)
  // Buscar todas las mesas con ese número para detectar duplicados
  let found = await strapi.db.query('api::mesa.mesa').findMany({
    where: {
      restaurante: restauranteIdNum,
      number: numberNum
    },
    select: ['id', 'number', 'status', 'documentId'],
    orderBy: { id: 'asc' } // Ordenar por ID para consistencia
  });

  // Verificar si hay duplicados (más de una mesa con el mismo número)
  if (found.length > 1) {
    console.error(`[getMesaOrThrow] ⚠️ DUPLICADO DETECTADO: ${found.length} mesas encontradas con número ${numberNum} para restaurante ${restauranteIdNum}`);
    console.error(`[getMesaOrThrow] IDs de mesas duplicadas:`, found.map(m => m.id));
    // Usar la primera mesa encontrada (la más antigua por ID), pero loguear el error
    // TODO: En el futuro, podría implementarse una limpieza de duplicados
  }

  let mesa = found?.[0];
  
  // Si la mesa no existe, intentar crearla (con protección robusta contra duplicados)
  if (!mesa?.id) {
    // Estrategia: Intentar crear, y si falla o si después de crear encontramos duplicados,
    // buscar de nuevo y usar la primera (más antigua)
    let created = false;
    try {
      // Verificar una vez más antes de crear (protección contra race conditions)
      const preCreateCheck = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
          restaurante: restauranteIdNum,
          number: numberNum
        },
        select: ['id', 'number', 'status', 'documentId'],
        limit: 1
      });

      if (preCreateCheck.length > 0) {
        // La mesa fue creada entre búsquedas (race condition)
        mesa = preCreateCheck[0];
        console.log(`[getMesaOrThrow] Mesa ${numberNum} encontrada en verificación pre-creación (evitó duplicado)`);
      } else {
        // Crear la mesa solo si realmente no existe
        const newMesa = await strapi.entityService.create('api::mesa.mesa', {
          data: {
            number: numberNum,
            name: `Mesa ${numberNum}`,
            displayName: `Mesa ${numberNum}`,
            status: 'disponible',
            isActive: true,
            restaurante: { id: restauranteIdNum },
            publishedAt: new Date()
          }
        });
        created = true;
        console.log(`[getMesaOrThrow] Mesa ${numberNum} creada automáticamente para restaurante ${restauranteIdNum}`);
        
        // Después de crear, verificar si hay duplicados (otro proceso pudo crear una al mismo tiempo)
        const postCreateCheck = await strapi.db.query('api::mesa.mesa').findMany({
          where: {
            restaurante: restauranteIdNum,
            number: numberNum
          },
          select: ['id', 'number', 'status', 'documentId'],
          orderBy: { id: 'asc' }
        });

        if (postCreateCheck.length > 1) {
          // Se creó un duplicado - usar la primera (más antigua) y loguear
          console.error(`[getMesaOrThrow] ⚠️ DUPLICADO CREADO: Se detectaron ${postCreateCheck.length} mesas después de crear. Usando la más antigua.`);
          console.error(`[getMesaOrThrow] IDs:`, postCreateCheck.map(m => m.id));
          mesa = postCreateCheck[0]; // Usar la primera (más antigua)
        } else {
          mesa = {
            id: newMesa.id,
            number: newMesa.number || numberNum,
            status: newMesa.status || 'disponible',
            documentId: newMesa.documentId
          };
        }
      }
    } catch (createErr: any) {
      // Si falla la creación, buscar de nuevo (otro proceso pudo haberla creado)
      const errorRetryCheck = await strapi.db.query('api::mesa.mesa').findMany({
        where: {
          restaurante: restauranteIdNum,
          number: numberNum
        },
        select: ['id', 'number', 'status', 'documentId'],
        orderBy: { id: 'asc' },
        limit: 1
      });

      if (errorRetryCheck.length > 0) {
        mesa = errorRetryCheck[0];
        console.log(`[getMesaOrThrow] Mesa ${numberNum} encontrada después de error de creación (evitó duplicado)`);
      } else {
        // Si realmente no se pudo crear ni encontrar, lanzar error
        throw new ValidationError(`No se pudo crear ni encontrar la mesa ${numberNum}: ${createErr.message}`);
      }
    }
  }

  // Get documentId using entityService if needed (for draftAndPublish)
  let documentId: string | undefined = (mesa as any).documentId;
  if (!documentId) {
    try {
      const entity = await strapi.entityService.findOne('api::mesa.mesa', mesa.id, {
        fields: ['documentId'],
        publicationState: 'preview' // Include unpublished
      });
      documentId = entity?.documentId;
    } catch (err) {
      // If entityService fails, use id as fallback
      documentId = String(mesa.id);
    }
  }

  // Asegurar que la mesa esté publicada (pero NO modificar otros campos)
  if (documentId && documentId !== String(mesa.id)) {
    try {
      await strapi.entityService.update('api::mesa.mesa', documentId, {
        data: {
          publishedAt: new Date()
        }
      });
    } catch (err) {
      // If update fails, continue anyway
      console.warn(`[getMesaOrThrow] Could not ensure publication for mesa ${mesa.id}:`, err);
    }
  }

  return {
    id: mesa.id,
    documentId: documentId || String(mesa.id), // Fallback to id as string if documentId not available
    number: mesa.number,
    status: mesa.status
  };
}

/**
 * Update Table Status using Entity Service to ensure proper publication
 */
async function setTableStatus(mesaId: ID, status: 'ocupada' | 'disponible' | 'por_limpiar', currentSessionId: ID | null = null) {
  // First, get the documentId to use with entityService
  let documentId: string | undefined;
  try {
    const mesa = await strapi.entityService.findOne('api::mesa.mesa', mesaId, {
      fields: ['documentId']
    });
    documentId = mesa?.documentId;
  } catch (err) {
    // If entityService fails, try direct DB query
    const dbMesa = await strapi.db.query('api::mesa.mesa').findOne({
      where: { id: mesaId },
      select: ['documentId']
    });
    documentId = (dbMesa as any)?.documentId;
  }

  // If we still don't have documentId, use id as fallback
  const idToUse = documentId || String(mesaId);

  // Prepare update data
  const updateData: any = {
    status,
    publishedAt: new Date() // Ensure it's published
  };

  // Only set currentSession if provided
  if (currentSessionId !== null) {
    updateData.currentSession = currentSessionId;
  } else {
    // If currentSessionId is null, we need to clear the relation
    // In Strapi, setting to null clears the relation
    updateData.currentSession = null;
  }

  // Use entityService to update and publish properly
  try {
    const result = await strapi.entityService.update('api::mesa.mesa', idToUse, {
      data: updateData
    });
    return result;
  } catch (err) {
    // Fallback to DB query if entityService fails
    console.warn('[setTableStatus] entityService failed, using DB query fallback:', err);
    const result = await strapi.db.query('api::mesa.mesa').update({
      where: { id: mesaId },
      data: {
        status,
        currentSession: currentSessionId,
        publishedAt: new Date()
      }
    });
    return result;
  }
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

  // Mark table Occupied (Low Level)
  await setTableStatus(mesaId, 'ocupada', newSession.id);

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
    // Normalize items and calculate total
    const normalizedItems = items.map(it => {
      const q = Number(it?.qty ?? it?.quantity ?? 0);
      const p = Number(it?.unitPrice ?? it?.price ?? 0);
      const normalized = {
        quantity: q,
        unitPrice: p,
        totalPrice: q * p,
        productId: it.productId,
        notes: it?.notes || '',
        name: it?.name || '' // Preserve name for system products
      };
      return normalized;
    });

    const total = normalizedItems.reduce((s, it) => s + it.totalPrice, 0);

    // Ensure total is a valid number (not NaN)
    if (!Number.isFinite(total) || total < 0) {
      throw new ValidationError(`Invalid total calculated: ${total}. Check item prices and quantities.`);
    }

    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        order_status: 'pending',
        customerNotes: data?.customerNotes || '',
        total: Number(total), // Explicitly ensure it's a number
        restaurante: { id: Number(restaurante.id) },
        mesa_sesion: { id: Number(sesion.id) },
        publishedAt: new Date(),
      },
    });


    // Create Items with normalized values
    await Promise.all(normalizedItems.map(async (item, index) => {
      // Ensure all values are valid numbers
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const totalPrice = quantity * unitPrice;

      if (!item.productId) {
        throw new ValidationError(`Missing productId for item at index ${index}`);
      }

      // Check if this is a system product (sys-waiter-call, sys-pay-request, etc.)
      const isSystemProduct = typeof item.productId === 'string' && item.productId.startsWith('sys-');
      
      // For system products, quantity and price can be 0, but still need to be valid numbers
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity}`);
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new ValidationError(`Invalid unitPrice for product ${item.productId}: ${unitPrice}`);
      }
      if (!Number.isFinite(totalPrice)) {
        throw new ValidationError(`Invalid totalPrice calculated for product ${item.productId}: ${totalPrice}`);
      }

      // For system products, we don't require quantity > 0
      if (!isSystemProduct && quantity <= 0) {
        throw new ValidationError(`Invalid quantity for product ${item.productId}: ${quantity} (must be > 0 for regular products)`);
      }

      try {
        // Get the product name from the item if it's a system product
        // The frontend sends 'name' field for system products
        const systemProductName = item.name || '';
        
        // Build notes: include system product name if it's a system product
        let itemNotes = item.notes || '';
        if (isSystemProduct && systemProductName) {
          itemNotes = systemProductName + (itemNotes ? ` - ${itemNotes}` : '');
        }

        const itemData: any = {
          quantity: quantity,
          notes: itemNotes,
          UnitPrice: unitPrice,
          totalPrice: totalPrice,
          order: pedido.id,
          publishedAt: new Date()
        };

        // Only set product relation if it's NOT a system product
        if (!isSystemProduct) {
          const numericProductId = Number(item.productId);
          if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
            throw new ValidationError(`Invalid productId: ${item.productId} (must be a positive number for regular products)`);
          }
          itemData.product = numericProductId;
        }
        // For system products, product field is left undefined/null (schema allows it)

        const createdItem = await strapi.entityService.create('api::item-pedido.item-pedido', {
          data: itemData
        });
        return createdItem;
      } catch (err: any) {
        throw new ValidationError(`Failed to create item for product ${item.productId}: ${err.message}`);
      }
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

    // Cerrar cualquier sesión 'paid' existente antes de abrir una nueva
    // Esto es similar a cómo funciona cuando se paga una cuenta
    const paidSessions = await strapi.db.query('api::mesa-sesion.mesa-sesion').findMany({
      where: {
        mesa: mesa.id,
        session_status: 'paid'
      }
    });

    if (paidSessions.length > 0) {
      await strapi.db.query('api::mesa-sesion.mesa-sesion').updateMany({
        where: { id: { $in: paidSessions.map((s: any) => s.id) } },
        data: {
          session_status: 'closed',
          closedAt: new Date(),
          publishedAt: new Date()
        }
      });
    }

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
    try {
      const { slug } = ctx.params || {};
      const data = getPayload(ctx.request.body);
      const table = data?.table;

      if (!table) throw new ValidationError('Missing table');

      const restaurante = await getRestaurantBySlug(String(slug));
      const mesa = await getMesaOrThrow(restaurante.id, Number(table));

      // 2. Soft Close & Publish Sessions
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

      // 3. Update Table Status
      await setTableStatus(mesa.id, 'disponible', null);

      ctx.body = { data: { success: true, updated: updateRes?.count ?? 0 } };
    } catch (err: any) {
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
