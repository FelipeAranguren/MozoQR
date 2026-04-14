import { client, unwrap } from './client';

export async function fetchStockOverview(slug) {
  const res = await client.get(`/restaurants/${slug}/stock`);
  return unwrap(res);
}

export async function ajusteStock(slug, productoId, { new_quantity, notes }) {
  const res = await client.put(`/restaurants/${slug}/stock/${productoId}`, { new_quantity, notes });
  return unwrap(res);
}

export async function fetchStockAlertas(slug) {
  const res = await client.get(`/restaurants/${slug}/stock/alertas`);
  return unwrap(res);
}

export async function fetchMovimientosStock(slug, { productoId, type, desde, hasta, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  if (productoId) params.set('productoId', String(productoId));
  if (type) params.set('type', type);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/restaurants/${slug}/stock/movimientos?${params}`);
  return unwrap(res);
}

export async function crearCompra(slug, compra) {
  const res = await client.post(`/restaurants/${slug}/compras`, compra);
  return unwrap(res);
}

export async function fetchCompras(slug, { status, desde, hasta, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/restaurants/${slug}/compras?${params}`);
  return unwrap(res);
}

export async function fetchCompraDetalle(slug, id) {
  const res = await client.get(`/restaurants/${slug}/compras/${id}`);
  return unwrap(res);
}

export async function recibirCompra(slug, id) {
  const res = await client.put(`/restaurants/${slug}/compras/${id}/recibir`);
  return unwrap(res);
}

export async function cancelarCompra(slug, id) {
  const res = await client.put(`/restaurants/${slug}/compras/${id}/cancelar`);
  return unwrap(res);
}
