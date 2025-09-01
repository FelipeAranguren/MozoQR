// src/api/analytics.js
// Obtiene ventas por día (pedidos pagados) para un restaurante dado.
// Usa el helper `api` que ya utilizas en el proyecto (api.get).

import { api } from '../api';

/**
 * Normaliza una fecha JS a texto YYYY-MM-DD (zona UTC).
 */
function toYMD(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Devuelve un ISO string fin-de-día UTC para incluir el día completo.
 * Ej: 2025-08-27 -> 2025-08-27T23:59:59.999Z
 */
function endOfDayISO(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Construye querystring para Strapi v4.
 */
function buildQS(paramsObj) {
  const p = new URLSearchParams();
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p.toString();
}

/**
 * Trae todas las páginas de /pedidos con filtros dados.
 * Devuelve un array `data` plano (atributos ya combinados).
 */
async function fetchAllPedidos(qsBase) {
  let page = 1;
  const pageSize = 100;
  const out = [];

  // bucle de paginación
  // Nota: Strapi devuelve meta.pagination con total/pageCount/page/etc.
  // Aquí vamos pidiendo hasta que no haya más.
  // publicationState=preview: permite ver registros no publicados si fuera necesario.
  // Ajusta si no lo necesitas.
  // IMPORTANTE: usamos fields mínimos para performance.
  while (true) {
    const url = `/pedidos?${qsBase}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const res = await api.get(url);
    const items = res?.data?.data ?? [];
    // Aplanado mínimo: id + attributes
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
 * Obtiene ventas por día para el restaurante `slug` en el rango [start, end].
 *
 * @param {string} slug - identificador del restaurante (p.ej. "mcdonalds")
 * @param {{start?: Date|string, end?: Date|string}} options - rango opcional
 * @returns {Promise<{series: Array<{date: string, total: number}>, grandTotal: number}>}
 */
export async function fetchSalesByDay(slug, options = {}) {
  if (!slug) throw new Error('slug requerido');

  // Rango por defecto: últimos 30 días
  const end = options.end ? new Date(options.end) : new Date();
  const start = options.start
    ? new Date(options.start)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  // Armamos QS base para filtrar:
  // - Restaurante por slug
  // - Sólo pedidos pagados
  // - Filtrar por updatedAt en rango (asumimos que el pago ocurre cuando updatedAt marca el cambio a "paid")
  // - Fields mínimos para performance
  const qs = buildQS({
    'filters[restaurante][slug][$eq]': slug,
    'filters[order_status][$eq]': 'paid',
    'filters[updatedAt][$gte]': new Date(start).toISOString(),
    'filters[updatedAt][$lte]': endOfDayISO(end),
    'fields[0]': 'id',
    'fields[1]': 'total',
    'fields[2]': 'order_status',
    'fields[3]': 'createdAt',
    'fields[4]': 'updatedAt',
    // Quitar si no usas borradores/publicación
    'publicationState': 'preview',
    // sort opcional
    'sort[0]': 'updatedAt:asc',
  });

  const pedidos = await fetchAllPedidos(qs);

  // Agrupar por día (YYYY-MM-DD) usando updatedAt (momento en que quedó pagado)
  const byDay = new Map();
  let grandTotal = 0;

  for (const p of pedidos) {
    // seguridad: sólo sumamos pagados
    if (p.order_status !== 'paid') continue;

    const key = toYMD(p.updatedAt || p.createdAt || new Date());
    const prev = byDay.get(key) || 0;
    const t = Number(p.total || 0);
    byDay.set(key, prev + (Number.isFinite(t) ? t : 0));
    grandTotal += Number.isFinite(t) ? t : 0;
  }

  // Completar días vacíos dentro del rango con 0 (para gráficos continuos)
  const filled = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor <= endUTC) {
    const key = toYMD(cursor);
    filled.push({ date: key, total: byDay.get(key) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    series: filled,       // [{date:'YYYY-MM-DD', total:Number}, ...] ordenado ascendente
    grandTotal,           // suma total del período
  };
}

export default {
  fetchSalesByDay,
};
