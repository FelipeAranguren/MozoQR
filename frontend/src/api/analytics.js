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

/** Convierte un límite exclusivo en ISO inclusivo (último ms dentro del rango) */
function toInclusiveEndISO(exclusiveDate) {
  if (!exclusiveDate) return null;
  const d = new Date(exclusiveDate);
  const time = d.getTime();
  if (!Number.isFinite(time)) return null;
  d.setTime(time - 1);
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

function ensurePlainText(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    for (const candidate of Object.values(value)) {
      const text = ensurePlainText(candidate, null);
      if (text) return text;
    }
  }
  return fallback;
}

function readProductName(product) {
  if (!product) return null;
  const candidates = [
    product?.name,
    product?.nombre,
    product?.title,
    product?.titulo,
    product?.label,
  ];
  for (const cand of candidates) {
    const text = ensurePlainText(cand, null);
    if (text) return text;
  }
  if (product?.data?.attributes) return readProductName(product.data.attributes);
  return null;
}

function readItemName(it) {
  if (!it) return null;
  const directCandidates = [
    it?.name,
    it?.nombre,
    it?.productName,
    it?.product_name,
    it?.title,
  ];
  for (const cand of directCandidates) {
    const text = ensurePlainText(cand, null);
    if (text) return text;
  }
  const product = unwrapEntity(it?.product ?? it?.producto ?? null);
  const fromProduct = readProductName(product);
  if (fromProduct) return fromProduct;
  return null;
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

    const nameDirect =
      a?.name ??
      a?.nombre ??
      a?.productName ??
      a?.product_name ??
      a?.title ??
      a?.titulo ??
      a?.label ??
      null;

    return {
      id: node?.id ?? a?.id ?? null,
      quantity: qty,
      product: prod,
      name: nameDirect ?? undefined,
      productName: a?.productName ?? a?.product_name ?? undefined,
      nombre: a?.nombre ?? undefined,
    };
  });
}

/* ------------------------- fetchers de pedidos ------------------------ */

/**
 * Lee **número o nombre de mesa** desde múltiples estructuras posibles del pedido.
 * Importante: **NO** devuelve códigos/slug de sesión como fallback. Si no hay mesa, devuelve '—'.
 */
function pickMesaNumberFromOrderAttrs(a) {
  // 👉 1) Buscar mesa directamente en el pedido
  const direct =
    a?.mesa?.data?.attributes?.number ??
    a?.mesa?.data?.attributes?.numero ??
    a?.mesa?.data?.attributes?.name ??
    a?.mesa?.data?.attributes?.nombre ??
    a?.mesa?.number ??
    a?.mesa?.numero ??
    a?.mesa?.name ??
    a?.mesa?.nombre ??
    a?.tableNumber ??
    a?.mesaNumber ??
    null;
  if (direct != null) return direct;

  // 👉 2) Buscar en mesa_sesion o mesaSesion (ambas variantes)
  const unwrap = (x) => (x?.attributes ? { id: x.id, ...x.attributes } : x) || null;
  const msRaw = a?.mesa_sesion ?? a?.mesaSesion ?? null;
  const ms = unwrap(msRaw?.data ?? msRaw);
  const mesaR = ms?.mesa ? (ms.mesa?.data ?? ms.mesa) : null;
  const mesa = unwrap(mesaR);

  const num =
    mesa?.number ??
    mesa?.numero ??
    mesa?.name ??
    mesa?.nombre ??
    mesa?.label ??
    null;
  if (num != null) return num;

  // 👉 3) Buscar en mesa_sesion.mesa.id como último recurso (para debug)
  if (mesa?.id) return `#${mesa.id}`;

  // 👉 4) No hay mesa asociada
  return '—';
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
        documentId: row.documentId ?? a.documentId ?? null,
        order_status: a.order_status,
        total: Number(a.total ?? 0),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        customerNotes: a.customerNotes ?? null,
        staffNotes: a.staffNotes ?? null,

        mesa: mesaNumber,               // 👈 número/nombre si existe; '—' si no hay
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
        a?.order?.id ??
        (typeof a.order === 'number' ? a.order : null) ??
        a?.pedido?.data?.id ??
        a?.pedido?.id ??
        (typeof a.pedido === 'number' ? a.pedido : null) ??
        null;
      const orderDocumentId =
        a?.order?.data?.documentId ??
        a?.order?.documentId ??
        a?.order?.data?.attributes?.documentId ??
        a?.pedido?.data?.documentId ??
        a?.pedido?.documentId ??
        a?.pedido?.data?.attributes?.documentId ??
        null;

      const nameDirect =
        a?.name ??
        a?.nombre ??
        a?.productName ??
        a?.product_name ??
        a?.title ??
        a?.titulo ??
        a?.label ??
        null;

      out.push({
        id: row.id ?? a.id,
        quantity: Number(a.quantity ?? a.qty ?? 0),
        createdAt: a.createdAt,
        product: prod,
        orderId,
        orderDocumentId,
        name: nameDirect ?? undefined,
        productName: a?.productName ?? a?.product_name ?? undefined,
        nombre: a?.nombre ?? undefined,
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

function itemHasIdentity(it) {
  const product = unwrapEntity(it?.product ?? it?.producto ?? null);
  const productId = product?.id ?? it?.productId ?? it?.productoId ?? null;
  const name = readItemName({ ...it, product });
  return !!(productId != null || (name && name !== 'Sin nombre'));
}

function orderNeedsItemEnrichment(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return true;
  return !items.some((it) => itemHasIdentity(it));
}

/**
 * Variante robusta para IA:
 * - Usa pedidos pagados como base
 * - Si los items vienen sin identidad (sin nombre/producto), los enriquece con /item-pedidos
 */
export async function getPaidOrdersForAI({ slug, from, to }) {
  const baseOrders = await getPaidOrdersWithItems({ slug, from, to });
  if (!Array.isArray(baseOrders) || !baseOrders.length) return [];

  const needsEnrichment = baseOrders.some(orderNeedsItemEnrichment);
  if (!needsEnrichment) return baseOrders;

  const orderIds = Array.from(
    new Set(
      baseOrders
        .map((o) => Number(o?.id))
        .filter((n) => Number.isFinite(n))
    )
  );
  if (!orderIds.length) return baseOrders;

  // Query por IDs concretos para evitar filtros relacionales frágiles por slug/fecha.
  const chunkSize = 80;
  const allItems = [];
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);

    const qOrder = new URLSearchParams();
    chunk.forEach((id, idx) => qOrder.append(`filters[order][id][$in][${idx}]`, String(id)));
    qOrder.append('populate[product]', 'true');
    qOrder.append('populate[order]', 'true');
    qOrder.append('sort[0]', 'createdAt:desc');

    const byOrderItems = await fetchAllItemPedidos(qOrder.toString());
    allItems.push(...(byOrderItems || []));

    // Fallback por alias "pedido" para instalaciones con naming distinto
    if (!byOrderItems || byOrderItems.length === 0) {
      const qPedido = new URLSearchParams();
      chunk.forEach((id, idx) => qPedido.append(`filters[pedido][id][$in][${idx}]`, String(id)));
      qPedido.append('populate[product]', 'true');
      qPedido.append('populate[pedido]', 'true');
      qPedido.append('sort[0]', 'createdAt:desc');
      const byPedidoItems = await fetchAllItemPedidos(qPedido.toString());
      allItems.push(...(byPedidoItems || []));
    }
  }

  const items = allItems;
  if (!Array.isArray(items) || !items.length) return baseOrders;

  const byOrder = new Map();
  const byOrderDoc = new Map();
  for (const it of items) {
    const orderId = Number(it?.orderId);
    if (Number.isFinite(orderId)) {
      const arr = byOrder.get(orderId) || [];
      arr.push(it);
      byOrder.set(orderId, arr);
    }

    const docId = String(it?.orderDocumentId || '').trim();
    if (docId) {
      const byDocArr = byOrderDoc.get(docId) || [];
      byDocArr.push(it);
      byOrderDoc.set(docId, byDocArr);
    }
  }

  return baseOrders.map((order) => {
    const orderId = Number(order?.id);
    const orderDocId = String(order?.documentId || '').trim();
    const extraById = Number.isFinite(orderId) ? (byOrder.get(orderId) || []) : [];
    const extraByDoc = orderDocId ? (byOrderDoc.get(orderDocId) || []) : [];
    const extra = extraById.length ? extraById : extraByDoc;
    if (!extra.length) return order;

    if (orderNeedsItemEnrichment(order)) {
      return {
        ...order,
        items: extra,
      };
    }
    return order;
  });
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

  const startDate = new Date(from);
  const startISO = Number.isFinite(startDate.getTime()) ? startDate.toISOString() : new Date().toISOString();
  const endISO = toInclusiveEndISO(new Date(to)) || startISO;

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
    if (countsA.size > 0) return finalizeTopProducts(countsA, limit);
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
    if (countsB.size > 0) return finalizeTopProducts(countsB, limit);
  }

  {
    const ordersWithItems = await getPaidOrdersWithItems({ slug, from, to });
    const aggregatedItems = [];
    for (const o of ordersWithItems) {
      const list = Array.isArray(o.items) ? o.items : [];
      aggregatedItems.push(...list);
    }
    const countsC = sumByProduct(aggregatedItems);
    if (countsC.size > 0) return finalizeTopProducts(countsC, limit);

  }

  return [];
}
/* ------------------------------- utils -------------------------------- */

function sumByProduct(items) {
  const counts = new Map();
  let unknownIndex = 0;

  for (const it of items || []) {
    const qty = Number(it?.quantity ?? it?.qty ?? 0);
    if (!qty) continue;

    const product = unwrapEntity(it?.product ?? it?.producto ?? null);
    const productId = product?.id ?? it?.productId ?? it?.productoId ?? null;
    const nameCandidate = readItemName({ ...it, product }) || null;

    let key;
    if (productId != null) key = `id:${productId}`;
    else if (nameCandidate) key = `name:${nameCandidate}`;
    else if (it?.id != null) key = `item:${it.id}`;
    else key = `unknown:${unknownIndex++}`;

    const entry = counts.get(key) || { qty: 0, name: null, productId: productId ?? null, product: null };
    entry.qty += qty;
    if (!entry.product && product) entry.product = product;
    if (!entry.name && nameCandidate) entry.name = nameCandidate;
    if (!entry.productId && productId != null) entry.productId = productId;
    counts.set(key, entry);
  }

  for (const entry of counts.values()) {
    if (!entry.name && entry.product) entry.name = readProductName(entry.product);
    if (!entry.name) entry.name = 'Sin nombre';
  }

  return counts;
}

function toTopArray(mapCounts, limit) {
  return Array.from(mapCounts.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
    .map(({ name, qty, productId }) => ({ name, qty, productId }));
}

async function finalizeTopProducts(countsMap, limit) {
  const list = toTopArray(countsMap, limit);
  await hydrateProductNames(list);
  return list.map(({ name, qty }) => ({ name, qty }));
}

async function hydrateProductNames(list) {
  // Buscar los que todavía no tienen nombre pero sí productId
  const missing = list.filter(
    (entry) => (!entry.name || entry.name === 'Sin nombre') && entry.productId != null
  );
  if (!missing.length) return list;

  const uniqueIds = Array.from(new Set(missing.map((entry) => entry.productId))).filter(
    (id) => id != null
  );
  if (!uniqueIds.length) return list;

  // Pedimos múltiples variantes de nombre (casos español/inglés)
  const params = new URLSearchParams();
  uniqueIds.forEach((id, idx) => {
    params.append(`filters[id][$in][${idx}]`, id);
  });
  params.append('fields[0]', 'id');
  params.append('fields[1]', 'name');
  params.append('fields[2]', 'nombre');
  params.append('fields[3]', 'title');
  params.append('fields[4]', 'titulo');
  params.append('fields[5]', 'label');
  params.append('pagination[pageSize]', String(uniqueIds.length));

  let products = [];
  try {
    const res = await api.get(`/productos?${params.toString()}`);
    const data = res?.data;
    if (Array.isArray(data?.data)) products = data.data;
    else if (Array.isArray(data)) products = data;
  } catch {
    // si falla la petición, devolvemos sin romper
    return list;
  }

  const idToName = new Map();
  for (const raw of products) {
    if (!raw) continue;
    const product = raw?.attributes ? { id: raw.id, ...raw.attributes } : raw;
    const id = product?.id ?? null;
    if (id == null) continue;

    const name =
      ensurePlainText(
        product?.name ??
          product?.nombre ??
          product?.title ??
          product?.titulo ??
          product?.label,
        null
      );

    if (name) idToName.set(Number(id), name);
  }

  list.forEach((entry) => {
    if (!entry) return;
    if (!entry.name || entry.name === 'Sin nombre') {
      const name = idToName.get(Number(entry.productId));
      if (name) entry.name = name;
    }
  });

  return list;
}

export default {
  fetchSalesByDay,
  getPaidOrders,
  getPaidOrdersForAI,
  getTotalOrdersCount,
  getSessionsCount,
  fetchRecentPaidOrders,
  fetchTopProducts,
};
