// frontend/src/api/tenant.js
import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

export const http = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

/* ---------------- UTILS ---------------- */
function buildMediaURL(relUrl) {
  if (!relUrl) return null;
  if (String(relUrl).startsWith('http')) return relUrl;
  const filesBase = (baseURL || '').replace(/\/api\/?$/, '');
  return filesBase + relUrl;
}

// Normalizadores (aceptan varias keys)
function normQty(it) {
  return Number(it?.qty ?? it?.quantity ?? it?.cant ?? it?.amount ?? it?.qtySelected ?? 0);
}
function normPrice(it) {
  return Number(it?.unitPrice ?? it?.price ?? it?.precio ?? it?.unit_price ?? 0);
}

function calcCartTotal(items = []) {
  return items.reduce((s, it) => {
    const q = normQty(it);
    const p = normPrice(it);
    const line = q * p;
    return s + (Number.isFinite(line) ? line : 0);
  }, 0);
}

/* ---------------- MENÚS ---------------- */
export async function fetchMenus(slug) {
  // Namespaced (si existe)
  try {
    const { data } = await http.get(`/restaurants/${slug}/menus`);
    const products = [];
    (data?.data?.categories || []).forEach((cat) => {
      (cat?.products || []).forEach((p) => {
        products.push({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p?.image?.url ? buildMediaURL(p.image.url) : null,
        });
      });
    });
    return { restaurantName: data?.data?.name || slug, products };
  } catch {
    // Fallback: colecciones Strapi v4
    try {
      const res = await http.get(
        `/restaurantes?filters[slug][$eq]=${encodeURIComponent(
          slug
        )}&populate[productos][populate][image]=true`
      );
      const restaurante = res?.data?.data?.[0];
      const products =
        (restaurante?.productos || []).map((p) => {
          const fm = p?.image?.formats;
          const rel = fm?.small?.url || fm?.thumbnail?.url || p?.image?.url || null;
          return { id: p.id, name: p.name, price: p.price, image: buildMediaURL(rel) };
        }) || [];
      return { restaurantName: restaurante?.name || slug, products };
    } catch (err) {
      console.error('fetchMenus fallback error:', err?.response?.data || err?.message || err);
      return { restaurantName: slug, products: [] };
    }
  }
}

/* ---------------- HELPERS ---------------- */
async function getRestaurantBySlug(slug) {
  const { data } = await http.get(
    `/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&fields[0]=id&fields[1]=name`
  );
  const r = data?.data?.[0];
  if (!r?.id) throw new Error('Restaurante no encontrado por slug');
  return { id: Number(r.id), name: r.name };
}

// buscar el id numérico real del pedido usando su documentId
async function findPedidoIdByDocumentId(documentId) {
  if (!documentId) return null;
  const params = new URLSearchParams();
  params.append('filters[documentId][$eq]', documentId);
  params.append('fields[0]', 'id');
  params.append('fields[1]', 'documentId');
  params.append('publicationState', 'preview');
  params.append('sort', 'updatedAt:desc');
  params.append('pagination[pageSize]', '1');
  try {
    const { data } = await http.get(`/pedidos?${params.toString()}`);
    const first = data?.data?.[0];
    return first?.id ? Number(first.id) : null;
  } catch (e) {
    console.warn('findPedidoIdByDocumentId error:', e?.response?.data || e?.message);
    return null;
  }
}

async function createItemPedido(pedidoId, it) {
  const quantity = normQty(it);
  const unitPrice = normPrice(it);
  const total = quantity * unitPrice;

  return http.post('/item-pedidos', {
    data: {
      product: Number(it?.productId ?? it?.id),
      order: Number(pedidoId),
      quantity,
      notes: it?.notes || '',
      UnitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      totalPrice: Number.isFinite(total) ? total : 0,
      publishedAt: new Date().toISOString(),
    },
  });
}

/* ---------------- PEDIDOS ---------------- */
export async function createOrder(slug, payload) {
  const { table, tableSessionId, items = [], notes } = payload || {};
  if (table === undefined || table === null || table === '') throw new Error('Falta número de mesa');
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');

  const total = calcCartTotal(items);

  // 1) Namespaced: el controller setea restaurante y debería devolver documentId
  try {
    const res = await http.post(`/restaurants/${slug}/orders`, {
      data: {
        table: Number(table),
        tableSessionId,
        customerNotes: notes || '',
        total, // se envía; el backend puede ignorarlo si recalcula
        items: items.map((i) => ({
          productId: i.productId ?? i.id,
          qty: normQty(i),
          price: normPrice(i),
          notes: i.notes || '',
        })),
      },
    });

    // extraer documentId de la respuesta en forma defensiva
    const payloadData = res?.data?.data ?? res?.data ?? {};
    const docId =
      payloadData?.documentId ??
      payloadData?.document_id ??
      payloadData?.attributes?.documentId ??
      null;

    // si tenemos documentId, buscar el id numérico real y actualizar total ahí
    if (docId) {
      try {
        const realId = await findPedidoIdByDocumentId(docId);
        if (realId) {
          await http.put(`/pedidos/${realId}`, {
            data: { total, publishedAt: new Date().toISOString() },
          });
        }
      } catch (eFix) {
        console.warn('PUT total via documentId falló:', eFix?.response?.data || eFix?.message);
      }
    }

    return res.data; // { data: {..., documentId} }
  } catch (eNS) {
    if (eNS?.response?.status && eNS.response.status !== 404) {
      console.warn('Namespaced endpoint error, fallback:', eNS.response.data || eNS.message);
    }
  }

  // 2) Fallback /pedidos: acá la API devuelve id numérico; seguimos igual
  const restaurant = await getRestaurantBySlug(slug);
  const restaurantId = Number(restaurant.id);

  // Intento A: restaurante como id plano
  let created;
  try {
    created = await http.post('/pedidos', {
      data: {
        table: Number(table),
        order_status: 'pending',
        customerNotes: notes || '',
        tableSessionId: tableSessionId || null,
        total,
        restaurante: restaurantId,
        publishedAt: new Date().toISOString(),
      },
    });
  } catch (ePlain) {
    // Intento B: restaurante como objeto { id }
    created = await http.post('/pedidos', {
      data: {
        table: Number(table),
        order_status: 'pending',
        customerNotes: notes || '',
        tableSessionId: tableSessionId || null,
        total,
        restaurante: { id: restaurantId },
        publishedAt: new Date().toISOString(),
      },
    });
  }

  const pedidoId = created?.data?.data?.id;
  if (!pedidoId) throw new Error('No se pudo crear el pedido (sin id)');

  await Promise.all(items.map((it) => createItemPedido(pedidoId, it)));

  return { data: { id: pedidoId } };
}

export async function closeAccount(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (table === undefined || table === null || table === '')
    throw new Error('Falta número de mesa');
  try {
    const res = await http.post(`/restaurants/${slug}/close-account`, {
      data: { table, tableSessionId },
    });
    return res.data; // { data: { paidOrders } }
  } catch (err) {
    // Algunos despliegues exigen PUT para actualizar recursos.
    if (err?.response?.status === 405) {
      const res = await http.put(`/restaurants/${slug}/close-account`, {
        data: { table, tableSessionId },
      });
      return res.data;
    }
    throw err;
  }
}

export async function hasOpenAccount(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (table === undefined || table === null || table === '') return false;
  try {
    const parts = [
      `filters[restaurante][slug][$eq]=${encodeURIComponent(slug)}`,
      `filters[table][$eq]=${table}`,
      `filters[order_status][$ne]=paid`,
    ];
    if (tableSessionId)
      parts.push(
        `filters[tableSessionId][$eq]=${encodeURIComponent(tableSessionId)}`
      );
    const qs = parts.join('&');
    const res = await http.get(
      `/pedidos?${qs}&fields[0]=id&pagination[pageSize]=1`
    );
    return Array.isArray(res?.data?.data) && res.data.data.length > 0;
  } catch (err) {
    console.warn('hasOpenAccount error:', err?.response?.data || err);
    return false;
  }
}
