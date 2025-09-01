// src/api/analytics.js
// Ventas por día (pagados) + utilidades para KPIs (pedidos del período,
// total histórico y cantidad de sesiones de mesa en el período).

import { api } from '../api';

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

/** Paginado general /pedidos (normaliza plano o attributes) */
async function fetchAllPedidos(qsBase) {
  let page = 1;
  const pageSize = 100;
  const out = [];
  while (true) {
    const url = `/pedidos?${qsBase}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const res = await api.get(url);

    const items = res?.data?.data ?? [];
    for (const row of items) {
      const a = row.attributes ? row.attributes : row; // soporta ambas formas
      out.push({
        id: row.id ?? a.id,
        order_status: a.order_status,
        total: Number(a.total ?? 0),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        tableSessionId: a.tableSessionId ?? null,
      });
    }

    const meta = res?.data?.meta?.pagination;
    if (!meta) break;
    if (page >= (meta.pageCount || 1)) break;
    page += 1;
  }
  return out;
}

/**
 * Ventas por día (agrupa por día LOCAL usando createdAt).
 * NOTA: no filtramos por restaurante porque tu API actual no lo expone en /pedidos.
 */
export async function fetchSalesByDay(_slug, options = {}) {
  const end = options.end ? new Date(options.end) : new Date();
  const start = options.start
    ? new Date(options.start)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  const qs = buildQS({
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
    const t = Number(p.total || 0);
    byDay.set(key, (byDay.get(key) || 0) + (Number.isFinite(t) ? t : 0));
    grandTotal += Number.isFinite(t) ? t : 0;
  }

  // Completar días vacíos
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

/**
 * Pedidos "paid" en un rango [from, to] (para KPIs de período).
 * Reutiliza el mismo paginado/qs que el gráfico → consistencia total.
 */
export async function getPaidOrders({ from, to }) {
  const qs = buildQS({
    'filters[order_status][$eq]': 'paid',
    'filters[createdAt][$gte]': new Date(from).toISOString(),
    'filters[createdAt][$lte]': endOfDayLocalISO(to),
    'sort[0]': 'createdAt:asc',
  });

  return await fetchAllPedidos(qs);
}

/**
 * Total histórico de pedidos "paid" (lifetime).
 * Sin filtro de restaurante por el motivo explicado arriba.
 */
export async function getTotalOrdersCount() {
  const p = new URLSearchParams();
  p.set('filters[order_status][$eq]', 'paid');
  p.set('pagination[pageSize]', '1'); // mínimo payload

  const url = `/pedidos?${p.toString()}`;
  const res = await api.get(url);
  const total = res?.data?.meta?.pagination?.total;
  return Number(total || 0);
}

/**
 * Cantidad de sesiones de mesa (clientes atendidos) abiertas en el período.
 * Endpoint confirmado: /mesa-sesions (sin segunda "s").
 * Regla: cuenta sesiones con openedAt dentro del rango.
 */
export async function getSessionsCount({ from, to }) {
  const p = new URLSearchParams();
  if (from) p.set('filters[openedAt][$gte]', new Date(from).toISOString());
  if (to)   p.set('filters[openedAt][$lte]', endOfDayLocalISO(to));
  p.set('pagination[pageSize]', '1');
  p.set('fields[0]', 'id');

  const url = `/mesa-sesions?${p.toString()}`;
  const res = await api.get(url);
  const total = res?.data?.meta?.pagination?.total;
  return Number(total || 0);
}

export default {
  fetchSalesByDay,
  getPaidOrders,
  getTotalOrdersCount,
  getSessionsCount,
};
