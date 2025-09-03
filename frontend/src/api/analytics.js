// src/api/analytics.js
// Utilidades de analytics POR RESTAURANTE: series de ventas, KPIs y listados.

import { api } from '../api';

/* ------------------------------ helpers ------------------------------ */

/** YYYY-MM-DD en HORA LOCAL */
function toYMDLocal(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fin de día LOCAL -> ISO (cubre todo el día local) */
function endOfDayLocalISO(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** QS helper */
function buildQS(paramsObj) {
  const p = new URLSearchParams();
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

/* ------------------------- fetchers de pedidos ------------------------ */

/** Paginador general para /pedidos (soporta attributes o plano) */
async function fetchAllPedidos(qsBase) {
  let page = 1;
  const pageSize = 100;
  const out = [];
  while (true) {
    const url = `/pedidos?${qsBase}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const res = await api.get(url);

    const rows = res?.data?.data ?? [];
    for (const row of rows) {
      const a = row.attributes ? row.attributes : row;
      out.push({
        id: row.id ?? a.id,
        order_status: a.order_status,
        total: Number(a.total ?? 0),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,

        // relaciones útiles para "últimos pedidos"
        mesa: a.mesa ?? null,
        mesa_sesion: a.mesa_sesion ?? null,
        tableNumber: a.tableNumber ?? a.mesaNumber ?? null,

        items: a.items ?? a.lineItems ?? null,
      });
    }

    const meta = res?.data?.meta?.pagination;
    if (!meta) break;
    if (page >= (meta.pageCount || 1)) break;
    page++;
  }
  return out;
}

/** Paginador general para /item-pedidos */
async function fetchAllItemPedidos(qsBase) {
  let page = 1;
  const pageSize = 200;
  const out = [];
  while (true) {
    const url = `/item-pedidos?${qsBase}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const res = await api.get(url);

    const rows = res?.data?.data ?? [];
    for (const row of rows) {
      const a = row.attributes ? row.attributes : row;
      out.push({
        id: row.id ?? a.id,
        quantity: Number(a.quantity ?? 0),
        createdAt: a.createdAt,
        product:
          a?.product?.data?.attributes ??
          a?.product ??
          null,
        orderId:
          a?.order?.data?.id ??
          a?.order?.id ??
          null,
      });
    }

    const meta = res?.data?.meta?.pagination;
    if (!meta) break;
    if (page >= (meta.pageCount || 1)) break;
    page++;
  }
  return out;
}

/* ----------------------------- series/KPIs ---------------------------- */

export async function fetchSalesByDay(slug, options = {}) {
  if (!slug) throw new Error('slug requerido');

  const end = options.end ? new Date(options.end) : new Date();
  const start = options.start
    ? new Date(options.start)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  const qs = buildQS({
    'filters[restaurante][slug][$eq]': slug,
    'filters[order_status][$eq]': 'paid',
    'filters[createdAt][$gte]': new Date(start).toISOString(),
    'filters[createdAt][$lte]': endOfDayLocalISO(end),
    'sort[0]': 'createdAt:asc',
  });

  const pedidos = await fetchAllPedidos(qs);

  const byDay = new Map();
  let grandTotal = 0;
  for (const p of pedidos) {
    if (p.order_status !== 'paid') continue;
    const key = toYMDLocal(p.createdAt || new Date());
    const amount = Number(p.total || 0);
    byDay.set(key, (byDay.get(key) || 0) + (Number.isFinite(amount) ? amount : 0));
    grandTotal += Number.isFinite(amount) ? amount : 0;
  }

  const filled = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= endLocal) {
    const key = toYMDLocal(cursor);
    filled.push({ date: key, total: byDay.get(key) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { series: filled, grandTotal };
}

export async function getPaidOrders({ slug, from, to }) {
  if (!slug) throw new Error('slug requerido');

  const qs = buildQS({
    'filters[restaurante][slug][$eq]': slug,
    'filters[order_status][$eq]': 'paid',
    'filters[createdAt][$gte]': new Date(from).toISOString(),
    'filters[createdAt][$lte]': endOfDayLocalISO(to),
    'sort[0]': 'createdAt:asc',
  });

  return await fetchAllPedidos(qs);
}

export async function getTotalOrdersCount({ slug }) {
  if (!slug) throw new Error('slug requerido');

  const p = new URLSearchParams();
  p.set('filters[order_status][$eq]', 'paid');
  p.set('filters[restaurante][slug][$eq]', slug);
  p.set('pagination[pageSize]', '1');

  const url = `/pedidos?${p.toString()}`;
  const res = await api.get(url);
  const total = res?.data?.meta?.pagination?.total;
  return Number(total || 0);
}

export async function getSessionsCount({ slug, from, to }) {
  if (!slug) throw new Error('slug requerido');

  const p = new URLSearchParams();
  p.set('filters[restaurante][slug][$eq]', slug);
  if (from) p.set('filters[openedAt][$gte]', new Date(from).toISOString());
  if (to)   p.set('filters[openedAt][$lte]', endOfDayLocalISO(to));
  p.set('pagination[pageSize]', '1');
  p.set('fields[0]', 'id');

  const url = `/mesa-sesions?${p.toString()}`;
  const res = await api.get(url);
  const total = res?.data?.meta?.pagination?.total;
  return Number(total || 0);
}

/* ----------------------------- listados UI ---------------------------- */

/** Últimos N pedidos pagados: por defecto N=5 */
export async function fetchRecentPaidOrders({ slug, limit = 5 }) {
  if (!slug) throw new Error('slug requerido');

  const p = new URLSearchParams();
  p.set('filters[restaurante][slug][$eq]', slug);
  p.set('filters[order_status][$eq]', 'paid');
  p.set('pagination[pageSize]', String(limit));
  p.set('sort[0]', 'createdAt:desc');
  // v4 populate
  p.set('populate[mesa_sesion][populate]', 'mesa');

  const url = `/pedidos?${p.toString()}`;
  const res = await api.get(url);
  const rows = res?.data?.data ?? [];

  return rows.map((row) => {
    const id = row.id ?? row?.attributes?.id;
    const a  = row.attributes ? row.attributes : row;

    const mesaNumber =
      a?.mesa?.number ??
      a?.mesa_sesion?.mesa?.number ??
      a?.mesa_sesion?.code ??
      a?.tableNumber ??
      a?.mesaNumber ??
      '—';

    return {
      id,
      total: Number(a.total ?? 0),
      createdAt: a.createdAt,
      mesa: mesaNumber,
    };
  });
}

/**
 * Top productos del período por CANTIDAD vendida (top 5 por defecto).
 * Estrategia robusta: obtenemos pedidos del período y luego filtramos item-pedidos por esos IDs.
 * NOTA: no filtramos por fecha en /item-pedidos para no perder relaciones; filtramos por orderId en cliente.
 */
export async function fetchTopProducts({ slug, from, to, limit = 5 }) {
  if (!slug) throw new Error('slug requerido');

  // 1) IDs de pedidos pagados del período
  const orders = await getPaidOrders({ slug, from, to });
  const orderIds = new Set(orders.map(o => o.id).filter(Boolean));
  if (orderIds.size === 0) return [];

  // 2) Traigo TODOS los items con product y order (paginados)
  const qs = buildQS({
    'sort[0]': 'createdAt:desc',
    'populate[product]': 'true',
    'populate[order]': 'true',
  });
  const items = await fetchAllItemPedidos(qs);

  // 3) Sumo cantidades por producto de esos pedidos
  const counts = new Map(); // name -> qty
  for (const it of items) {
    if (!orderIds.has(it.orderId)) continue;
    const name =
      it?.product?.name ??
      it?.product?.data?.attributes?.name ??
      'Sin nombre';
    const qty = Number(it.quantity || 0);
    if (!qty) continue;
    counts.set(name, (counts.get(name) || 0) + qty);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, qty]) => ({ name, qty }));
}

export default {
  fetchSalesByDay,
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
  fetchRecentPaidOrders,
  fetchTopProducts,
};
