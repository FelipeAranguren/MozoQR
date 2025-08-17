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

/* ---------------- MENÚS ---------------- */
export async function fetchMenus(slug) {
  // 1) Intentar endpoint namespaced si existe
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
    // 2) Fallback al modelo actual
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

async function createItemPedido(pedidoId, it) {
  const quantity = Number(it.qty || 0);
  const unitPrice = Number(it.unitPrice ?? it.price ?? it.precio ?? 0);
  const total = quantity * unitPrice;

  // Importante: usar ids planos (no connect) en REST
  return http.post('/item-pedidos', {
    data: {
      product: Number(it.productId ?? it.id),
      order: Number(pedidoId),
      quantity,
      notes: it.notes || '',
      UnitPrice: unitPrice,
      totalPrice: total,
      publishedAt: new Date().toISOString(),
    },
  });
}

/* ---------------- PEDIDOS ---------------- */
export async function createOrder(slug, payload) {
  const { table, tableSessionId, items = [], notes } = payload || {};
  if (table === undefined || table === null || table === '') throw new Error('Falta número de mesa');
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');

  // 1) Intentar primero el endpoint namespaced (nuestro controller setea restaurante server-side)
  try {
    const res = await http.post(`/restaurants/${slug}/orders`, {
      data: {
        table,
        tableSessionId,
        customerNotes: notes || '',
        items: items.map((i) => ({
          productId: i.productId ?? i.id,
          qty: i.qty,
          price: i.unitPrice ?? i.price ?? i.precio,
          notes: i.notes || '',
        })),
      },
    });
    return res.data; // { data: { id } }
  } catch (eNS) {
    // Si existe y falló por otra razón que no sea 404, logueamos y caemos al fallback
    if (eNS?.response?.status && eNS.response.status !== 404) {
      console.warn('Namespaced order endpoint error, falling back:', eNS.response.data || eNS.message);
    }
  }

  // 2) Fallback al core controller POST /pedidos (por compatibilidad)
  const restaurant = await getRestaurantBySlug(slug);
  const restaurantId = Number(restaurant.id);

  const total = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.unitPrice ?? it.price ?? it.precio ?? 0),
    0
  );

  // Intento A: id plano
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
    // Intento B: objeto { id }
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
