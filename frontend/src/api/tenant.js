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
  try {
    // namespaced (si existe)
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
    // fallback Strapi directo
    try {
      const res = await http.get(
        `/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[productos][populate][image]=true`
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

/* ---------------- PEDIDOS ---------------- */
export async function createOrder(slug, payload) {
  const { table, tableSessionId, items = [], notes } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');

  const total = calcCartTotal(items);

  // ✅ namespaced endpoint: crea pedido + ítems y asocia a mesa_sesion
  const res = await http.post(`/restaurants/${slug}/orders`, {
    data: {
      table: Number(table),
      tableSessionId: tableSessionId || null,
      customerNotes: notes || '',
      total,
      items: items.map((i) => ({
        productId: i.productId ?? i.id,
        qty: normQty(i),
        price: normPrice(i),
        notes: i.notes || '',
      })),
    },
  });

  return res.data; // { data: { id, documentId, ... } }
}

export async function closeAccount(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  try {
    const res = await http.post(`/restaurants/${slug}/close-account`, {
      data: { table, tableSessionId },
    });
    return res.data; // { data: { paidOrders } }
  } catch (err) {
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
  if (!table) return false;
  try {
    const params = new URLSearchParams();
    params.append('filters[restaurante][slug][$eq]', slug);
    params.append('filters[order_status][$ne]', 'paid');
    params.append('filters[mesa_sesion][mesa][number][$eq]', String(table));
    if (tableSessionId) {
      params.append('filters[mesa_sesion][code][$eq]', tableSessionId);
    }
    params.append('fields[0]', 'id');
    params.append('pagination[pageSize]', '1');
    const { data } = await http.get(`/pedidos?${params.toString()}`);
    return Array.isArray(data?.data) && data.data.length > 0;
  } catch (err) {
    console.warn('hasOpenAccount error:', err?.response?.data || err);
    return false;
  }
}
