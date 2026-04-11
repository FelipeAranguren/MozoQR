/**
 * Etiquetas de estado de pedido en español (cliente / menú).
 */

const PRIORITY = { preparing: 2, pending: 1 };

/** Badge junto al producto en el menú: solo pending / preparing */
export function menuBadgeLabelForOrderStatus(status) {
  if (status === 'pending') return 'En espera';
  if (status === 'preparing') return 'En preparación';
  return null;
}

/** Título principal en la pantalla post-pedido */
export function confirmationHeadlineForStatus(status) {
  if (status === 'preparing') return 'En preparación';
  if (status === 'pending') return 'Pedido recibido';
  if (status === 'served') return 'Listo para servir';
  if (status === 'paid') return 'Pedido cerrado';
  if (status === 'cancelled') return 'Pedido cancelado';
  return 'Estado del pedido';
}

export function confirmationSubtitleForStatus(status) {
  if (status === 'preparing') {
    return 'Tu pedido está siendo preparado en cocina.';
  }
  if (status === 'pending') {
    return 'Recibimos tu pedido. Pronto comenzarán a prepararlo.';
  }
  if (status === 'served') {
    return 'El personal te lo acercará a la mesa.';
  }
  if (status === 'paid') {
    return 'Gracias por tu visita.';
  }
  if (status === 'cancelled') {
    return 'Si necesitás ayuda, llamá al mozo desde el menú.';
  }
  return '';
}

/** Lista de pedidos en el pie / modales (todos los estados visibles al cliente) */
export function customerOrderListStatusLabel(status) {
  const map = {
    pending: 'En espera',
    preparing: 'En preparación',
    served: 'Listo para servir',
    paid: 'Pagado',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

/**
 * Por producto: el estado "más avanzado" entre pedidos abiertos (preparing gana a pending).
 * @param {Array<{ order_status: string, items: Array<{ productId?: string|number }> }>} orders
 * @returns {Record<string, 'pending'|'preparing'>}
 */
export function buildProductOrderStatusMap(orders) {
  const out = {};
  for (const order of orders || []) {
    const st = order.order_status;
    if (st !== 'pending' && st !== 'preparing') continue;
    const p = PRIORITY[st] || 0;
    for (const it of order.items || []) {
      const pid = it.productId != null ? String(it.productId) : null;
      if (!pid) continue;
      const prev = out[pid];
      if (!prev || p > (PRIORITY[prev] || 0)) out[pid] = st;
    }
  }
  return out;
}
