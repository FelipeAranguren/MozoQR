import { client, unwrap } from './client';

/**
 * Create order
 */
export async function createOrder(
    slug,
    { table, tableSessionId, items, notes, clientRequestId }
) {
    const res = await client.post(`/restaurants/${slug}/orders`, {
        data: { table, tableSessionId, items, notes, clientRequestId },
    });
    return unwrap(res);
}

/**
 * List orders (polling)
 */
export async function listOrders(slug, { status, table, since } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (table) params.set('table', String(table));
    if (since) params.set('since', since);
    const res = await client.get(
        `/restaurants/${slug}/orders?` + params.toString()
    );
    return unwrap(res);
}

/**
 * Update order status
 */
export async function patchOrderStatus(slug, orderId, status) {
    const res = await client.patch(`/restaurants/${slug}/orders/${orderId}/status`, {
        data: { status },
    });
    return unwrap(res);
}
