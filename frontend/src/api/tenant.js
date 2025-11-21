// frontend/src/api/tenant.js
import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';
const IDEM_ON = String(import.meta.env?.VITE_IDEMPOTENCY || '').toLowerCase() === 'on';

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

/* --- Seguridad (helpers locales, sin renombrar nada) --- */
function sanitizeNotes(s) {
  if (!s) return s;
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeIdempotencyKey(payload) {
  // hash simple y determinístico sobre el contenido del pedido
  const data = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return `ik-${Math.abs(hash)}`;
}

/* ---------------- MENÚS ---------------- */
export async function fetchMenus(slug) {
  // 1) Intento namespaced (si no existe, 404 -> seguimos al fallback)
  try {
    const { data } = await http.get(`/restaurants/${slug}/menus`);
    const products = [];
    (data?.data?.categories || []).forEach((cat) => {
      // El endpoint namespaced devuelve "productos" no "products"
      (cat?.productos || cat?.products || []).forEach((p) => {
        products.push({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p?.image?.url ? buildMediaURL(p.image.url) : p?.image || null,
          description: p?.description ?? null,
        });
      });
    });
    if (products.length) {
      return { 
        restaurantName: data?.data?.restaurant?.name || data?.data?.name || slug, 
        products,
        categories: data?.data?.categories || []
      };
    }
  } catch (e) {
    console.warn('menus namespaced error:', e?.response?.status, e?.response?.data || e?.message);
  }

  // 2) Fallback directo a Strapi (v4)
  try {
    const qs =
  `?filters[slug][$eq]=${encodeURIComponent(slug)}` +
  `&publicationState=preview` +
  `&populate[productos][fields][0]=id` +
  `&populate[productos][fields][1]=name` +
  `&populate[productos][fields][2]=price` +
  `&populate[productos][fields][3]=description` +
  `&populate[productos][populate][image][fields][0]=url` +
  `&fields[0]=id&fields[1]=name`;



    const res = await http.get(`/restaurantes${qs}`);
    const restaurante = res?.data?.data?.[0];
    const products =
      (restaurante?.productos || []).map((p) => {
        const fm = p?.image?.formats;
        const rel = fm?.small?.url || fm?.thumbnail?.url || p?.image?.url || null;
        const description =
          p?.description ?? p?.attributes?.description ?? null;
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          image: buildMediaURL(rel),
          description,
        };
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

  // Sanitizar notas antes de enviar (defensivo; el servidor también debe sanitizar)
  const safeNotes = sanitizeNotes(notes || '');
  const safeItems = items.map((i) => ({
    productId: i.productId ?? i.id,
    qty: normQty(i),
    price: normPrice(i),
    notes: sanitizeNotes(i.notes || ''),
  }));

  const total = calcCartTotal(items);

  // Clave idempotente (solo si está habilitada por env para evitar CORS hasta configurar backend)
  const idemKey = IDEM_ON
    ? makeIdempotencyKey({
        slug,
        table: Number(table),
        tableSessionId: tableSessionId || null,
        items: safeItems.map(({ productId, qty, price, notes }) => ({ productId, qty, price, notes })),
      })
    : null;

  // ✅ namespaced endpoint: crea pedido + ítems y asocia a mesa_sesion
  const res = await http.post(
    `/restaurants/${slug}/orders`,
    {
      data: {
        table: Number(table),
        customerNotes: safeNotes,
        total, // el servidor recalcula/valida; se envía por compatibilidad con el contrato actual
        items: safeItems,
      },
    },
    IDEM_ON ? { headers: { 'Idempotency-Key': idemKey } } : undefined
  );

  return res.data; // { data: { id, documentId, ... } }
}

export async function closeAccount(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  const data = { table };
  if (tableSessionId) data.tableSessionId = tableSessionId;
  let res;
  try {
    res = await http.post(`/restaurants/${slug}/close-account`, { data });
  } catch (err) {
    if (err?.response?.status === 405) {
      res = await http.put(`/restaurants/${slug}/close-account`, { data });
    } else {
      throw err;
    }
  }

  // Aseguramos que todos los pedidos de la mesa queden marcados como paid
  try {
    const params = new URLSearchParams();
    params.append('filters[restaurante][slug][$eq]', slug);
    params.append('filters[order_status][$ne]', 'paid');
    params.append('fields[0]', 'id');
    params.append('populate[mesa_sesion][populate][mesa][fields][0]', 'number');
    params.append('pagination[pageSize]', '100');

    const { data: list } = await http.get(`/pedidos?${params.toString()}`);
    const rows = list?.data || [];

    const pendientes = rows.filter((row) => {
      const a = row.attributes || row;
      const ses = a.mesa_sesion?.data || a.mesa_sesion;
      const mesa = ses?.attributes?.mesa?.data || ses?.mesa;
      const num = mesa?.attributes?.number ?? mesa?.number;
      return Number(num) === Number(table);
    });

    await Promise.all(
      pendientes.map((row) =>
        http.put(`/pedidos/${row.id}`, { data: { order_status: 'paid' } })
      )
    );
  } catch (e) {
    console.warn('closeAccount sync paid error:', e?.response?.data || e);
  }

  return res?.data;
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
