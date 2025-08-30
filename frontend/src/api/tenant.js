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
  // 1) Intento namespaced (si no existe, 404 -> seguimos al fallback)
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
    if (products.length) {
      return { restaurantName: data?.data?.name || slug, products };
    }
  } catch (e) {
    // útil para entender si es 404 (endpoint no existe) o 403 (permisos)
    console.warn('menus namespaced error:', e?.response?.status, e?.response?.data || e?.message);
  }

  // 2) Fallback directo a Strapi (v4)
  try {
    const qs =
      `?filters[slug][$eq]=${encodeURIComponent(slug)}` +
      `&publicationState=preview` +
      `&populate[productos][populate][image]=true` +
      `&fields[0]=id&fields[1]=name`;

    const res = await http.get(`/restaurantes${qs}`);
    const restaurante = res?.data?.data?.[0];
    const products =
      (restaurante?.productos || []).map((p) => {
        const fm = p?.image?.formats;
        const rel = fm?.small?.url || fm?.thumbnail?.url || p?.image?.url || null;
        return { id: p.id, name: p.name, price: p.price, image: buildMediaURL(rel) };
      }) || [];

    return { restaurantName: restaurante?.name || slug, products };
  } catch (err) {
    console.error('fetchMenus fallback error:', err?.response?.status, err?.response?.data || err?.message);
    return { restaurantName: slug, products: [] };
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
  const { table } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  try {
    const res = await http.post(`/restaurants/${slug}/close-account`, { data: { table } });
    return res.data;
  } catch (err) {
    if (err?.response?.status === 405) {
      const res = await http.put(`/restaurants/${slug}/close-account`, { data: { table } });
      return res.data;
    }
    throw err;
  }
}


export async function hasOpenAccount(slug, payload) {
  const { table } = payload || {};
  if (table === undefined || table === null || table === '') return false;

  try {
    const params = new URLSearchParams();
    params.append('filters[restaurante][slug][$eq]', slug);
    params.append('filters[order_status][$ne]', 'paid');
    params.append('fields[0]', 'id');
    params.append('fields[1]', 'order_status');
    // poblar lo justo para conocer el número de mesa
    params.append('populate[mesa_sesion][fields][0]', 'id');
    params.append('populate[mesa_sesion][populate][mesa][fields][0]', 'number');
    params.append('pagination[pageSize]', '100');

    const { data } = await http.get(`/pedidos?${params.toString()}`);
    const rows = data?.data || [];

    // aplanado defensivo (v4)
    const anyForThisTable = rows.some((row) => {
      const a = row.attributes || row;
      const ses = a.mesa_sesion?.data || a.mesa_sesion;
      const mesa = ses?.attributes?.mesa?.data || ses?.mesa;
      const num = mesa?.attributes?.number ?? mesa?.number;
      return Number(num) === Number(table) && a.order_status !== 'paid';
    });

    return anyForThisTable;
  } catch (err) {
    console.warn('hasOpenAccount error:', err?.response?.data || err);
    return false;
  }
}

