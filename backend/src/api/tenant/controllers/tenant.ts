// backend/src/api/tenant/controllers/tenant.ts
import { errors } from '@strapi/utils';
const { ValidationError, NotFoundError } = errors;

type Ctx = {
  params?: Record<string, any>;
  request: { body: any };
  body?: any;
};

export default {
  /**
   * POST /restaurants/:slug/orders
   * Crea un pedido para un restaurante (busca restaurante por slug),
   * luego crea sus ítems usando ids planos (REST).
   */
  async createOrder(ctx: Ctx) {
    const { slug } = ctx.params || {};
    const raw = ctx.request.body;
    const data = (raw && (raw as any).data) ? (raw as any).data : raw || {};

    if (!slug) throw new ValidationError('Missing restaurant slug');

    const table = data?.table;
    const tableSessionId: string | null = data?.tableSessionId ?? null;
    const customerNotes: string = data?.customerNotes ?? '';
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    if (table === undefined || table === null || table === '') {
      throw new ValidationError('Missing table');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Empty items');
    }

    // 1) Buscar restaurante por slug
    const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
      filters: { slug },
      fields: ['id', 'name'],
      publicationState: 'live',
      limit: 1,
    });
    const restaurante = restaurantes?.[0];
    if (!restaurante?.id) throw new NotFoundError('Restaurante no encontrado');

    // 2) Calcular total (si no vino del cliente)
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

    // 3) Crear pedido
    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        table: Number(table),
        order_status: 'pending',
        customerNotes,
        tableSessionId,
        total,
        restaurante: restaurante.id, // relación por id plano en REST
        publishedAt: new Date(),
      },
    });

    // 4) Crear ítems (usar id plano en REST; evita 'connect')
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

    ctx.body = { data: { id: pedido.id } };
  },

  /**
   * POST /restaurants/:slug/close-account
   * Marca todos los pedidos de la mesa como pagados.
   */
  async closeAccount(ctx) {
    const { slug } = ctx.params || {};
    const raw = ctx.request.body;
    const data = (raw && (raw as any).data) ? (raw as any).data : raw || {};

    const table = data?.table;
    const tableSessionId: string | null = data?.tableSessionId || null;

    if (!slug) throw new ValidationError('Missing restaurant slug');
    if (table === undefined || table === null || table === '')
      throw new ValidationError('Missing table');

    // Buscar restaurante por slug
    const restaurantes = await strapi.entityService.findMany(
      'api::restaurante.restaurante',
      {
        filters: { slug },
        fields: ['id'],
        publicationState: 'live',
        limit: 1,
      }
    );
    const restaurante = restaurantes?.[0];
    if (!restaurante?.id) throw new NotFoundError('Restaurante no encontrado');

    // Buscar pedidos pendientes de la mesa
    const filters: any = {
      restaurante: restaurante.id,
      table: Number(table),
      order_status: { $ne: 'paid' },
    };
    if (tableSessionId) filters.tableSessionId = tableSessionId;

    const pedidos = await strapi.entityService.findMany('api::pedido.pedido', {
      filters,
      fields: ['id'],
      publicationState: 'live',
    });

    const ids = (pedidos || []).map((p: any) => p.id);
    await Promise.all(
      ids.map((id: number) =>
        strapi.entityService.update('api::pedido.pedido', id, {
          data: { order_status: 'paid' },
        })
      )
    );

    ctx.body = { data: { paidOrders: ids.length } };
  },
};