import { api } from '../api';

export async function staffCreateOrder(slug, { table, tableSessionId, items, notes }) {
  const res = await api.post(`/restaurants/${slug}/orders`, {
    table,
    tableSessionId,
    items,
    notes: notes || 'Pedido manual (staff)',
  });
  return res.data?.data ?? res.data;
}

export async function staffAddOrderItem(slug, orderId, { productId, quantity = 1, notes }) {
  const res = await api.post(`/restaurants/${slug}/orders/${orderId}/items`, {
    productId,
    quantity,
    notes,
  });
  return res.data?.data ?? res.data;
}

export async function staffUpdateOrderItem(slug, orderId, itemId, { quantity, notes }) {
  const res = await api.patch(`/restaurants/${slug}/orders/${orderId}/items/${itemId}`, {
    quantity,
    notes,
  });
  return res.data?.data ?? res.data;
}

export async function staffDeleteOrderItem(slug, orderId, itemId) {
  const res = await api.delete(`/restaurants/${slug}/orders/${orderId}/items/${itemId}`);
  return res.data?.data ?? res.data;
}
