// backend/src/api/tenant/controllers/tenant.ts
import { errors } from '@strapi/utils';
const { ApplicationError, NotFoundError, ValidationError } = errors;

type CreateOrderItem = {
  productId?: number | string;
  id?: number | string;
  qty?: number | string;
  unitPrice?: number | string;
  price?: number | string;
  notes?: string;
};

export default {
  /**
   * POST /restaurants/:slug/orders
   * Crea un Pedido e Item-Pedidos, forzando la relación 'restaurante' por slug.
   * Público por ahora (MVP). Luego se agrega policy y throttling.
   */
  async createOrder(ctx) {
    const { slug } = ctx.params || {};
    const raw = ctx.request.body;
    const data = (raw && (raw as any).data) ? (raw as any).data : raw || {};

    const table = data?.table;
    const items: CreateOrderItem[] = Array.isArray(data?.items) ? data.items : [];
    const customerNotes: string = data?.customerNotes || '';
    const tableSessionId: string | null = data?.tableSessionId || null;

    if (!slug) throw new ValidationError('Missing restaurant slug');
    if (table === undefined || table === null || table === '') throw new ValidationError('Missing table');
    if (!items.length) throw new ValidationError('Empty items');

    // 1) Buscar restaurante por slug (solo publicados)
    const restaurantes = await strapi.entityService.findMany('api::restaurante.restaurante', {
      filters: { slug },
      fields: ['id', 'name'],
      publicationState: 'live',
      limit: 1,
    });
    const restaurante = restaurantes?.[0];
    if (!restaurante?.id) throw new NotFoundError('Restaurante no encontrado');

    // 2) Calcular total/subtotal
    const subtotal = items.reduce((sum, it) => {
      const qty = Number(it?.qty ?? 0);
      const unit = Number(it?.unitPrice ?? it?.price ?? 0);
      return sum + qty * unit;
    }, 0);

    // 3) Crear Pedido forzando relación 'restaurante'
    const pedido = await strapi.entityService.create('api::pedido.pedido', {
      data: {
        table: Number(table),
        order_status: 'pending', // mapea al enum actual: pending|preparing|served|paid
        customerNotes,
        tableSessionId,
        total: subtotal,
        restaurante: restaurante.id, // << clave: se setea en el servidor
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
};
