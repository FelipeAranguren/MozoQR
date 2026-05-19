/**
 * Helpers para que staff edite ítems de pedidos abiertos.
 */

const EDITABLE_STATUSES = ['pending', 'preparing', 'served'];

export async function loadStaffOrder(strapi: any, orderId: number, restauranteId: number) {
  const order = await strapi.entityService.findOne('api::pedido.pedido', orderId, {
    fields: ['id', 'order_status', 'total', 'staffNotes', 'customerNotes'],
    populate: {
      restaurante: { fields: ['id'] },
      items: {
        populate: { product: { fields: ['id', 'name', 'price'] } },
      },
    },
  });
  if (!order?.id) return { error: 'not_found' as const };
  const rid = order.restaurante?.id ?? order.restaurante;
  if (String(rid) !== String(restauranteId)) {
    return { error: 'forbidden' as const };
  }
  if (!EDITABLE_STATUSES.includes(order.order_status)) {
    return { error: 'not_editable' as const, order };
  }
  return { order };
}

export async function recalculateOrderTotal(strapi: any, orderId: number) {
  const items = await strapi.entityService.findMany('api::item-pedido.item-pedido', {
    filters: { order: orderId },
    fields: ['totalPrice'],
    limit: 500,
  });
  const total = (items || []).reduce((sum: number, it: any) => sum + Number(it.totalPrice || 0), 0);
  await strapi.entityService.update('api::pedido.pedido', orderId, {
    data: { total },
  });
  return total;
}

export async function validateProductForRestaurant(
  strapi: any,
  productId: number,
  restauranteId: number
) {
  const prod = await strapi.entityService.findOne('api::producto.producto', productId, {
    fields: ['id', 'name', 'price', 'available'],
    populate: { restaurante: { fields: ['id'] } },
  });
  if (!prod?.id) return null;
  const rid = prod.restaurante?.id ?? prod.restaurante;
  if (String(rid) !== String(restauranteId)) return null;
  if (!prod.available) return { error: 'unavailable', name: prod.name };
  return prod;
}

export async function getFullOrder(strapi: any, orderId: number) {
  return strapi.entityService.findOne('api::pedido.pedido', orderId, {
    populate: {
      items: { populate: { product: { fields: ['name', 'sku', 'price'] } } },
      mesa_sesion: { populate: { mesa: { fields: ['number'] } } },
    },
  });
}
