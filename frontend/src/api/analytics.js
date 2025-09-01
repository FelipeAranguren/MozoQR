// src/api/analytics.js
// Obtiene ventas por día (pedidos pagados) para un restaurante dado.

import { api } from '../api';

/** Normaliza una fecha JS a texto YYYY-MM-DD usando HORA LOCAL (no UTC). */
function toYMDLocal(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fin-de-día en HORA LOCAL convertido a ISO para la query (incluye todo el día local). */
function endOfDayLocalISO(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999); // localtime
  return d.toISOString();      // el backend recibe ISO en Z
}

/** Construye querystring para Strapi v4. */
function buildQS(paramsObj) {
  const p = new URLSearchParams();
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

/** Trae todas las páginas de /pedidos con filtros dados. */
async function fetchAllPedidos(qsBase) {
  let page = 1;
  const pageSize = 100;
  const out = [];
  while (true) {
    const url = `/pedidos?${qsBase}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const res = await api.get(url);
    const items = res?.data?.data ?? [];
    for (const row of items) {
      const a = row.attributes || row;
      out.push({
        id: row.id || a.id,
        total: Number(a.total ?? 0),
        order_status: a.order_status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
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
 * Obtiene ventas por día para el restaurante `slug` en el rango [start, end] (LOCAL).
 */
export async function fetchSalesByDay(slug, options = {}) {
  if (!slug) throw new Error('slug requerido');

  // Rango por defecto: últimos 30 días (LOCAL)
  const end = options.end ? new Date(options.end) : new Date();
  const start = options.start
    ? new Date(options.start)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  // Filtros: usamos updatedAt en ISO, pero el fin de día es el LOCAL.
  const qs = buildQS({
    'filters[restaurante][slug][$eq]': slug,
    'filters[order_status][$eq]': 'paid',
    'filters[updatedAt][$gte]': new Date(start).toISOString(),
    'filters[updatedAt][$lte]': endOfDayLocalISO(end),
    'fields[0]': 'id',
    'fields[1]': 'total',
    'fields[2]': 'order_status',
    'fields[3]': 'createdAt',
    'fields[4]': 'updatedAt',
    'publicationState': 'preview',
    'sort[0]': 'updatedAt:asc',
  });

  const pedidos = await fetchAllPedidos(qs);

  // Agrupar por DÍA LOCAL usando updatedAt (cuando quedó pagado)
  const byDay = new Map();
  let grandTotal = 0;

  for (const p of pedidos) {
    if (p.order_status !== 'paid') continue;
    const key = toYMDLocal(p.updatedAt || p.createdAt || new Date());
    const prev = byDay.get(key) || 0;
    const t = Number(p.total || 0);
    byDay.set(key, prev + (Number.isFinite(t) ? t : 0));
    grandTotal += Number.isFinite(t) ? t : 0;
  }

  // Completar días vacíos en el rango con 0 (LOCAL)
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

export default { fetchSalesByDay };
