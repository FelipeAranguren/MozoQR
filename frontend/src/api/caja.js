import { client, unwrap } from './client';

export async function abrirCaja(slug, { initial_balance = 0, notes } = {}) {
  const res = await client.post(`/restaurants/${slug}/caja/abrir`, { initial_balance, notes });
  return unwrap(res);
}

export async function cerrarCaja(slug, { notes } = {}) {
  const res = await client.put(`/restaurants/${slug}/caja/cerrar`, { notes });
  return unwrap(res);
}

export async function fetchCajaActual(slug) {
  const res = await client.get(`/restaurants/${slug}/caja/actual`);
  return res?.data;
}

export async function fetchCajaHistorial(slug, { desde, hasta, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/restaurants/${slug}/caja/historial?${params}`);
  return unwrap(res);
}

export async function crearMovimientoCaja(slug, movimiento) {
  const res = await client.post(`/restaurants/${slug}/caja/movimiento`, movimiento);
  return unwrap(res);
}

export async function fetchMovimientosCaja(slug, { caja_sesion_id, type, desde, hasta, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  if (caja_sesion_id) params.set('caja_sesion_id', String(caja_sesion_id));
  if (type) params.set('type', type);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/restaurants/${slug}/caja/movimientos?${params}`);
  return unwrap(res);
}

export async function fetchCajaResumen(slug, { desde, hasta } = {}) {
  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  const res = await client.get(`/restaurants/${slug}/caja/resumen?${params}`);
  return unwrap(res);
}
