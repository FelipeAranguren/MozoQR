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

/* ------------ normalizadores v4 (unwrap de data/attributes) ----------- */

function unwrapEntity(e) {
  if (!e) return null;
  if (e?.attributes || typeof e?.id !== 'undefined') {
    const id = e.id ?? e?.attributes?.id ?? null;
    const attrs = e.attributes ?? e;
    return { id, ...attrs };
  }
  return e;
}

/** Convierte items v4 (objeto con .data) en array plano [{quantity, product}, ...] */
function normalizeItemsField(field) {
  if (!field) return null;
  if (Array.isArray(field)) return field;

  const arr = Array.isArray(field?.data) ? field.data : null;
  if (!arr) return null;

  return arr.map((node) => {
    const a = node?.attributes ?? node ?? {};
    const qty = Number(a.quantity ?? a.qty ?? 0);
    const prodRaw =
      a?.product?.data ??
      a?.product ??
      a?.producto?.data ??
      a?.producto ??
      null;
    const prod = unwrapEntity(prodRaw);

    return {
      id: node?.id ?? a?.id ?? null,
      quantity: qty,
      product: prod,
    };
  });
}

/* ------------------------- fetchers de pedidos ------------------------ */

function pickMesaNumberFromOrderAttrs(a) {
  // 1) Campos directos
  const direct =
    a?.tableNumber ??
    a?.mesaNumber ??
    a?.mesa?.number ??
    a?.mesa?.numero ??
    a?.mesa?.name ??
    a?.mesa?.nombre ??
    a?.mesa?.data?.attributes?.number ??
    a?.mesa?.data?.attributes?.numero ??
    a?.mesa?.data?.attributes?.name ??
    a?.mesa?.data?.attributes?.nombre;

  if (direct) return direct;

  // 2) mesa_sesion (snake) → mesa.number / mesa.nombre
  const ms = a?.mesa_sesion;
  const msMesaNumber =
    ms?.mesa?.number ??
    ms?.mesa?.numero ??
    ms?.mesa?.name ??
    ms?.mesa?.nombre ??
    ms?.mesa?.data?.attributes?.number ??
    ms?.mesa?.data?.attributes?.numero ??
    ms?.mesa?.data?.attributes?.name ??
    ms?.mesa?.data?.attributes?.nombre;
  if (msMesaNumber) return msMesaNumber;

  // 3) mesaSesion (camel) → mesa.number / mesa.nombre
  const ms2 = a?.mesaSesion;
  const ms2MesaNumber =
    ms2?.mesa?.number ??
    ms2?.mesa?.numero ??
    ms2?.mesa?.name ??
    ms2?.mesa?.nombre ??
    ms2?.mesa?.data?.attributes?.number ??
    ms2?.mesa?.data?.attributes?.numero ??
    ms2?.mesa?.data?.attributes?.name ??
    ms2?.mesa?.data?.attributes?.nombre;
  if (ms2MesaNumber) return ms2MesaNumber;

  // 4) Último recurso: códigos de sesión (no deseable, pero informativo)
  const code =
    ms?.code ??
    ms?.mesa_code ??
    ms2?.code ??
    ms2?.mesa_code ??
    a?.tableSessionId ??
    a?.mesaSessionId ??
    a?.mesa_sesion_id ??
    null;

  return code || '—';
}

/**
 * Paginador general para /pedidos con populate tolerante:
 * 1) populate explícito
 * 2) si falla -> populate=*
 * 3) si falla -> sin populate
 */
async function fetchAllPedidos(qsBase) {
  let page = 1;
  const pageSize = 100;
  const out = [];

  const populateExplicit =
    'populate[mesa]=true&' +
    // ambas variantes de mesa_sesion
    'populate[mesa_sesion][populate]=mesa&' +
    'populate[mesaSesion][populate]=mesa&' +
    'populate[items][populate]=product,producto&' +
    'populate[lineItems][populate]=product,producto';

  const populateAll = 'populate=*';

  const makeUrl = (populateParams) =>
    `/pedidos?${qsBase}${populateParams ? `&${populateParams}` : ''}` +
    `&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;

  let populateMode = 'explicit';

  while (true) {
    let url = makeUrl(
      populateMode === 'explicit' ? populateExplicit : (populateMode === 'all' ? populateAll : '')
    );
    let res;
    try {
      res = await api.get(url);
    } catch (e1) {
      if (populateMode === 'explicit') {
        populateMode = 'all';
        continue;
      }
      if (populateMode === 'all') {
        populateMode = 'none';
        continue;
      }
      throw e1;
    }

    const rows = res?.data?.data ?? [];
    for (const row of rows) {
      const a = row.attributes ? row.attributes : row;

      const rawItems = a.items ?? a.lineItems ?? null;
      const itemsNorm = normalizeItemsField(rawItems) ?? null;

      const mesaNumber = pickMesaNumberFromOrderAttrs(a);

      out.push({
        id: row.id ?? a.id,
        order_status: a.order_status,
        total: Number(a.total ?? 0),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,

        mesa: mesaNumber,               // 👈 número si existe; code solo si no hay número
        mesa_sesion: a.mesa_sesion ?? a.mesaSesion ?? null,
        tableNumber: mesaNumber,        // compat vieja UI

        items: itemsNorm,
      });
    }

    const meta = res?.data?.meta?.pagination;
    if (!meta) break;
    if (page >= (meta.pageCount || 1)) break;
    page++;
  }
  return out;
}

/** Paginador general para /item-pedidos (con populate robusto) */
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

      const prodRaw =
        a?.product?.data ??
        a?.product ??
        a?.producto?.data ??
        a?.producto ??
        null;
      const prod = unwrapEntity(prodRaw);

      const orderId =
        a?.order?.data?.id ??
        (typeof a.order === 'number' ? a.order : null) ??
        a?.pedido?.data?.id ??
        a?.pedido?.id ??
        (typeof a.pedido === 'number' ? a.pedido : null) ??
        null;

      out.push({
        id: row.id ?? a.id,
        quantity: Number(a.quantity ?? a.qty ?? 0),
        createdAt: a.createdAt,
        product: prod,
        orderId,
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

async function getPaidOrdersWithItems({ slug, from, to }) {
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

export async function fetchRecentPaidOrders({ slug, limit = 5 }) {
  if (!slug) throw new Error('slug requerido');

  const p = new URLSearchParams();
  p.set('filters[restaurante][slug][$eq]', slug);
  p.set('filters[order_status][$eq]', 'paid');
  p.set('pagination[pageSize]', String(limit));
  p.set('sort[0]', 'createdAt:desc');

  // populate para ambas variantes
  p.set('populate[mesa]', 'true');
  p.set('populate[mesa_sesion][populate]', 'mesa');
  p.set('populate[mesaSesion][populate]', 'mesa');

  let rows = [];
  try {
    const url = `/pedidos?${p.toString()}`;
    const res = await api.get(url);
    rows = res?.data?.data ?? [];
  } catch {
    try {
      const q2 = new URLSearchParams(p);
      q2.set('populate', '*');
      q2.delete('populate[mesa]');
      q2.delete('populate[mesa_sesion][populate]');
      q2.delete('populate[mesaSesion][populate]');
      const url2 = `/pedidos?${q2.toString()}`;
      const res2 = await api.get(url2);
      rows = res2?.data?.data ?? [];
    } catch {
      const q3 = new URLSearchParams(p);
      q3.delete('populate[mesa]');
      q3.delete('populate[mesa_sesion][populate]');
      q3.delete('populate[mesaSesion][populate]');
      const url3 = `/pedidos?${q3.toString()}`;
      const res3 = await api.get(url3);
      rows = res3?.data?.data ?? [];
    }
  }

  return rows.map((row) => {
    const id = row.id ?? row?.attributes?.id;
    const a  = row.attributes ? row.attributes : row;

    const mesaNumber = pickMesaNumberFromOrderAttrs(a);

    return {
      id,
      total: Number(a.total ?? 0),
      createdAt: a.createdAt,
      mesa: mesaNumber,
    };
  });
}

/* ---------------------- Top productos (3 estrategias) ----------------- */

export async function fetchTopProducts({ slug, from, to, limit = 5 }) {
  if (!slug) throw new Error('slug requerido');

  const startISO = new Date(from).toISOString();
  const endISO   = endOfDayLocalISO(new Date(to));

  {
    const qsA = buildQS({
      'filters[order][restaurante][slug][$eq]': slug,
      'filters[order][order_status][$eq]': 'paid',
      'filters[order][createdAt][$gte]': startISO,
      'filters[order][createdAt][$lte]': endISO,
      'populate[product]': 'true',
      'populate[order]': 'true',
      'sort[0]': 'createdAt:desc',
    });

    const itemsA = await fetchAllItemPedidos(qsA);
    const countsA = sumByProduct(itemsA);
    if (countsA.size > 0) return toTopArray(countsA, limit);
  }

  {
    const qsB = buildQS({
      'filters[product][restaurante][slug][$eq]': slug,
      'filters[createdAt][$gte]': startISO,
      'filters[createdAt][$lte]': endISO,
      'populate[product]': 'true',
      'sort[0]': 'createdAt:desc',
    });

    const itemsB = await fetchAllItemPedidos(qsB);
    const countsB = sumByProduct(itemsB);
    if (countsB.size > 0) return toTopArray(countsB, limit);
  }

  {
    const ordersWithItems = await getPaidOrdersWithItems({ slug, from, to });
    const countsC = new Map();
    for (const o of ordersWithItems) {
      const list = Array.isArray(o.items) ? o.items : [];
      for (const it of list) {
        const prod = it?.product ? unwrapEntity(it.product) : null;
        const name =
          prod?.name ??
          prod?.nombre ??
          prod?.title ??
          'Sin nombre';
        const qty = Number(it?.quantity ?? it?.qty ?? 0);
        if (!qty) continue;
        countsC.set(name, (countsC.get(name) || 0) + qty);
      }
    }
    if (countsC.size > 0) return toTopArray(countsC, limit);
  }

  return [];
}

/* ------------------------------- utils -------------------------------- */

function sumByProduct(items) {
  const counts = new Map();
  for (const it of items || []) {
    const name =
      it?.product?.name ??
      it?.product?.nombre ??
      it?.product?.title ??
      'Sin nombre';
    const qty = Number(it?.quantity ?? 0);
    if (!qty) continue;
    counts.set(name, (counts.get(name) || 0) + qty);
  }
  return counts;
}

function toTopArray(mapCounts, limit) {
  return Array.from(mapCounts.entries())
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
