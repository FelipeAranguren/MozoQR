// backend/src/api/tenant/controllers/tenant.ts
import { errors } from '@strapi/utils';
const { ValidationError, NotFoundError } = errors;

type Ctx = {
  params?: Record<string, any>;
  request: { body: any };
  body?: any;
};

/* ----------------------- Helpers ----------------------- */
async function findRestauranteBySlug(slug: string) {
  const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
    filters: { slug: { $eq: slug } },
    fields: ['id', 'name'],
    publicationState: 'live',
    limit: 1,
  });
  return restaurantes?.[0] ?? null;
}

async function getOrCreateMesa(restauranteId: number, tableNumber: number) {
  const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
    filters: {
      restaurante: { id: { $eq: restauranteId } },
      number: { $eq: tableNumber },
    },
    fields: ['id', 'number'],
    publicationState: 'live',
    limit: 1,
  });
  if (mesas?.[0]) return mesas[0];

  return await strapi.entityService.create('api::mesa.mesa', {
    data: {
      number: tableNumber,
      isActive: true,
      restaurante: restauranteId,
      publishedAt: new Date(),
    },
  });
}

async function getOrCreateOpenSession(
  restauranteId: number,
  mesaId: number,
  tableSessionCode: string | null
) {
  const filters: any = {
    restaurante: { id: { $eq: restauranteId } },
    mesa: { id: { $eq: mesaId } },
    session_status: { $eq: 'open' },
  };
  if (tableSessionCode) filters.code = { $eq: tableSessionCode };

  const sesiones = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
    filters,
    fields: ['id', 'code', 'session_status'],
    publicationState: 'live',
    limit: 1,
  });
  if (sesiones?.[0]) return sesiones[0];

  const sesion = await strapi.entityService.create('api::mesa-sesion.mesa-sesion', {
    data: {
      code: tableSessionCode || undefined,
      session_status: 'open',
      openedAt: new Date(),
      total: 0,
      paidTotal: 0,
      mesa: mesaId,
      restaurante: restauranteId,
      publishedAt: new Date(),
    },
  });

  await strapi.entityService.update('api::mesa.mesa', mesaId, {
    data: { currentSession: sesion.id },
  });

  return sesion;
}

/* ----------------------- Controller ----------------------- */
export default {
  async createOrder(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const raw = ctx.request.body || {};
    const data = (raw && (raw as any).data) ? (raw as any).data : raw;

    if (!slug) throw new ValidationError('Missing restaurant slug');

    const table = data?.table;
    const tableSessionId: string | null = data?.tableSessionId ?? null;
    const customerNotes: string = data?.customerNotes ?? '';
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    if (table === undefined || table === null || table === '') {
      throw new ValidationError('Missing table');
    }
    if (!items.length) throw new ValidationError('Empty items');

    const restaurante = await findRestauranteBySlug(slug);
    if (!restaurante?.id) throw new NotFoundError('Restaurante no encontrado');

    // 👇 casteamos ids a number
    const mesa = await getOrCreateMesa(Number(restaurante.id), Number(table));              // 👈
    const sesion = await getOrCreateOpenSession(Number(restaurante.id), Number(mesa.id), tableSessionId); // 👈

    const calcTotal = (arr: any[]) =>
      arr.reduce((s, it) => {
        const q = Number(it?.qty ?? 0);
        const p = Number(it?.unitPrice ?? it?.price ?? 0);
        const line = q * p;
        return s + (Number.isFinite(line) ? line : 0);
      }, 0);

    const total =
      data?.total !== undefined && data?.total !== null && data?.total !== ''
        ? Number(data.total)
        : calcTotal(items);

    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        order_status: 'pending',
        customerNotes,
        total,
        mesa_sesion: sesion.id,
        restaurante: restaurante.id,
        publishedAt: new Date(),
      },
    });

    await Promise.all(
      items.map((it) => {
        const quantity = Number(it?.qty ?? 0);
        const unit = Number(it?.unitPrice ?? it?.price ?? 0);
        const productId = Number(it?.productId ?? it?.id);
        if (!productId) throw new ValidationError('Item without productId');

        return strapi.entityService.create('api::item-pedido.item-pedido', {
          data: {
            quantity,
            notes: it?.notes || '',
            UnitPrice: unit,
            totalPrice: quantity * unit,
            order: pedido.id,
            product: productId,
            publishedAt: new Date(),
          },
        });
      })
    );

    const pedidosDeSesion = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: { mesa_sesion: { id: { $eq: sesion.id } } },
      fields: ['id', 'total'],
      publicationState: 'live',
      limit: 500,
    });
    const nuevoTotal = (pedidosDeSesion || []).reduce((s, p) => s + Number(p.total || 0), 0);
    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
      data: { total: nuevoTotal },
    });

    ctx.body = { data: { id: pedido.id, mesaSesionId: sesion.id } };
  },

  async closeAccount(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const raw = ctx.request.body || {};
    const data = (raw && (raw as any).data) ? (raw as any).data : raw;

    if (!slug) throw new ValidationError('Missing restaurant slug');

    const table = data?.table;
    const tableSessionId: string | null = data?.tableSessionId || null;
    if (table === undefined || table === null || table === '')
      throw new ValidationError('Missing table');

    const restaurante = await findRestauranteBySlug(slug);
    if (!restaurante?.id) throw new NotFoundError('Restaurante no encontrado');

    const mesas = await strapi.entityService.findMany('api::mesa.mesa', {
      filters: {
        restaurante: { id: { $eq: Number(restaurante.id) } },
        number: { $eq: Number(table) },
      },
      fields: ['id'],
      publicationState: 'live',
      limit: 1,
    });
    const mesa = mesas?.[0];
    if (!mesa?.id) throw new NotFoundError('Mesa no encontrada');

    const sesFilters: any = {
      restaurante: { id: { $eq: Number(restaurante.id) } },
      mesa: { id: { $eq: Number(mesa.id) } },
      session_status: { $eq: 'open' },
    };
    if (tableSessionId) sesFilters.code = { $eq: tableSessionId };

    const sesiones = await strapi.entityService.findMany('api::mesa-sesion.mesa-sesion', {
      filters: sesFilters,
      fields: ['id'],
      publicationState: 'live',
      limit: 1,
    });
    const sesion = sesiones?.[0];
    if (!sesion?.id) {
      ctx.body = { data: { paidOrders: 0, message: 'No open session' } };
      return;
    }

    const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
      filters: {
        mesa_sesion: { id: { $eq: sesion.id } },
        order_status: { $ne: 'paid' },
      },
      fields: ['id', 'total'],
      publicationState: 'live',
      limit: 500,
    });

    const ids = (pedidos || []).map((p: any) => p.id);
    await Promise.all(
      ids.map((id: number) =>
        strapi.entityService.update('api::pedido.pedido', id, {
          data: { order_status: 'paid' },
        })
      )
    );
    const totalPagado = (pedidos || []).reduce((s: number, p: any) => s + Number(p.total || 0), 0);

    await strapi.entityService.update('api::mesa-sesion.mesa-sesion', sesion.id, {
      data: { session_status: 'closed', closedAt: new Date(), paidTotal: totalPagado },
    });
    await strapi.entityService.update('api::mesa.mesa', Number(mesa.id), { data: { currentSession: null } });

    ctx.body = { data: { paidOrders: ids.length, mesaSesionId: sesion.id } };
  },
};
