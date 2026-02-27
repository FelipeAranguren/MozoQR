import { client } from './client';
import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';
const IDEM_ON = String(import.meta.env?.VITE_IDEMPOTENCY || '').toLowerCase() === 'on';

export const http = client;
// Instancia sin interceptores para peticiones públicas (evita errores 401 por tokens viejos/inválidos)
const publicHttp = axios.create({ baseURL });


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
    // ESTRATEGIA ROBUSTA:
    // 1. Pedimos SOLO los productos disponibles con su categoría e imagen.
    // 2. Ignoramos la relación directa 'categorias' del restaurante para evitar problemas de populate/permisos.
    // 3. Reconstruimos SIEMPRE las categorías a partir de los productos.

    const qs =
      `?filters[slug][$eq]=${encodeURIComponent(slug)}` +
      `&publicationState=preview` +
      `&populate[productos][filters][available][$eq]=true` +
      `&populate[productos][populate][0]=image` +
      `&populate[productos][populate][1]=categoria` +
      `&fields[0]=id&fields[1]=name`;

    const res = await http.get(`/restaurantes${qs}`);
    const restaurante = res?.data?.data?.[0];

    // Map products
    const mapProduct = (p) => {
      const fm = p?.image?.formats;
      const rel = fm?.small?.url || fm?.thumbnail?.url || p?.image?.url || null;
      const description = p?.description ?? p?.attributes?.description ?? null;

      // Extract category info if available
      const catData = p?.categoria?.data?.attributes || p?.categoria?.attributes || p?.categoria;
      const categoryId = p?.categoria?.data?.id || p?.categoria?.id;
      const categoryName = catData?.name;

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        image: buildMediaURL(rel),
        description,
        categoryId,
        categoryName
      };
    };

    // Filtrar solo productos disponibles antes de mapear (doble verificación por si el filtro de query no funcionó)
    const productosRaw = restaurante?.productos || [];
    const productosDisponibles = productosRaw.filter(p => {
      const attrs = p?.attributes || p;
      const available = attrs?.available ?? true; // Por defecto true si no está definido
      return available !== false; // Incluir solo si available !== false
    });
    const products = productosDisponibles.map(mapProduct) || [];

    // RECONSTRUCCIÓN FORZADA DE CATEGORÍAS
    // Agrupamos los productos por su nombre de categoría
    const catMap = {};
    const uncategorized = [];

    products.forEach(p => {
      if (p.categoryName) {
        if (!catMap[p.categoryName]) {
          catMap[p.categoryName] = {
            id: p.categoryId || `temp-${p.categoryName}`,
            name: p.categoryName,
            slug: p.categoryName.toLowerCase().replace(/\s+/g, '-'),
            productos: []
          };
        }
        catMap[p.categoryName].productos.push(p);
      } else {
        uncategorized.push(p);
      }
    });

    let categories = Object.values(catMap);

    // Ordenar categorías alfabéticamente
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // Opcional: Agregar "Sin Categoría" si hay productos sueltos
    if (uncategorized.length > 0) {
      categories.push({
        id: 'uncategorized',
        name: 'Otros',
        slug: 'otros',
        productos: uncategorized
      });
    }

    console.log(`✅ Menú reconstruido: ${products.length} productos en ${categories.length} categorías.`);

    return { restaurantName: restaurante?.name || slug, products, categories };
  } catch (err) {
    console.error('fetchMenus fallback error:', err?.response?.status, err?.response?.data || err?.message);
    return { restaurantName: slug, products: [], categories: [] };
  }
}

/* ---------------- PEDIDOS ---------------- */
export async function createOrder(slug, payload) {
  const { table, tableSessionId, items = [], notes } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');
  if (!tableSessionId) throw new Error('Falta tableSessionId');

  // Sanitizar notas antes de enviar (defensivo; el servidor también debe sanitizar)
  const safeNotes = sanitizeNotes(notes || '');
  const safeItems = items.map((i) => ({
    productId: i.productId ?? i.id,
    qty: normQty(i),
    price: normPrice(i),
    notes: sanitizeNotes(i.notes || ''),
    // Include name for system products (sys-waiter-call, sys-pay-request, etc.)
    ...(i.name ? { name: i.name } : {}),
  }));

  const total = calcCartTotal(items);
  
  // Check if any item is a system product (sys-waiter-call, sys-pay-request, etc.)
  const hasSystemProduct = items.some(i => {
    const productId = i.productId ?? i.id;
    return typeof productId === 'string' && productId.startsWith('sys-');
  });
  
  // Ensure total is a valid number (not NaN or string)
  const numericTotal = Number.isFinite(total) ? Number(total) : 0;
  // Allow total of 0 only for system products (waiter calls, payment requests, etc.)
  if (numericTotal < 0 || (!hasSystemProduct && numericTotal <= 0)) {
    throw new Error('El total del pedido debe ser mayor a cero');
  }

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
  let res;
  try {
    res = await http.post(
      `/restaurants/${slug}/orders`,
      {
        data: {
          table: Number(table),
          tableSessionId: String(tableSessionId),
          customerNotes: safeNotes,
          total: numericTotal, // Ensure it's always a number, not a formatted string
          items: safeItems,
        },
      },
      IDEM_ON ? { headers: { 'Idempotency-Key': idemKey } } : undefined
    );
  } catch (err) {
    const data = err?.response?.data;
    const msg =
      (data?.error && typeof data.error === 'object' && data.error?.message) ||
      (typeof data?.error === 'string' && data.error) ||
      err?.message ||
      'Error al crear el pedido. Intentá de nuevo.';
    throw new Error(msg);
  }

  if (!res?.data) {
    throw new Error('El servidor no devolvió el pedido creado. Intentá de nuevo.');
  }
  return res.data; // { data: { id, documentId, ... } }
}

/**
 * Abre una sesión de mesa (marca la mesa como ocupada) aunque no haya pedido todavía
 */
export async function openSession(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (table === undefined || table === null || table === '') {
    throw new Error('table requerido');
  }
  if (!tableSessionId) throw new Error('tableSessionId requerido');

  try {
    // Nuevo flujo: claim table (source of truth)
    const res = await publicHttp.post(`/restaurants/${slug}/tables/claim`, {
      data: { table: Number(table), tableSessionId: String(tableSessionId) },
    });
    return res?.data?.data || res?.data;
  } catch (err) {
    console.error('Error abriendo sesión de mesa:', err?.response?.data || err);
    throw err;
  }
}

export async function closeAccount(slug, payload) {
  const { table, tableSessionId, isManualSettlement } = payload || {};
  if (!table) throw new Error('Falta número de mesa');
  const data = { table };
  if (tableSessionId) data.tableSessionId = tableSessionId;
  if (isManualSettlement === true) data.isManualSettlement = true;
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
    params.append('fields[1]', 'documentId');
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
      pendientes.map((row) => {
        const apiId = row.documentId ?? row.attributes?.documentId ?? row.id;
        return http.put(`/pedidos/${apiId}`, { data: { order_status: 'paid' } });
      })
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
    // CRÍTICO: Excluir pedidos cancelados - no deben contar como cuenta abierta
    const anyForThisTable = rows.some((row) => {
      const a = row.attributes || row;
      const ses = a.mesa_sesion?.data || a.mesa_sesion;
      const mesa = ses?.attributes?.mesa?.data || ses?.mesa;
      const num = mesa?.attributes?.number ?? mesa?.number;
      return Number(num) === Number(table) && a.order_status !== 'paid' && a.order_status !== 'cancelled';
    });

    return anyForThisTable;
  } catch (err) {
    console.warn('hasOpenAccount error:', err?.response?.data || err);
    return false;
  }
}

/**
 * Obtiene los pedidos detallados de una mesa (no pagados)
 */
export async function fetchOrderDetails(slug, payload) {
  const { table, tableSessionId } = payload || {};
  if (!table) return [];

  try {
    const params = new URLSearchParams();
    params.append('filters[restaurante][slug][$eq]', slug);
    params.append('filters[order_status][$ne]', 'paid');

    // Revert deep filter to avoid 400 Bad Request
    // We will filter in memory as before

    params.append('fields[0]', 'id');
    params.append('fields[1]', 'order_status');
    params.append('fields[2]', 'total');
    params.append('fields[3]', 'customerNotes');
    params.append('fields[4]', 'createdAt');

    // Populate for filtering
    params.append('populate[mesa_sesion][fields][0]', 'id');
    params.append('populate[mesa_sesion][fields][1]', 'code');
    params.append('populate[mesa_sesion][populate][mesa][fields][0]', 'number');

    // Populate items and their products - Simplified to avoid 400
    params.append('populate[items][populate][product][fields][0]', 'name');
    params.append('populate[items][populate][product][fields][1]', 'price');

    params.append('sort[0]', 'createdAt:asc');
    params.append('pagination[pageSize]', '100');

    const { data } = await publicHttp.get(`/pedidos?${params.toString()}`);
    const rows = data?.data || [];

    // Filtrar por mesa (ignoramos sesión para mostrar todo lo acumulado de la mesa)
    // CRÍTICO: Excluir pedidos cancelados - no deben aparecer en el menú del cliente
    const ordersForTable = rows.filter((row) => {
      const a = row.attributes || row;
      const ses = a.mesa_sesion?.data || a.mesa_sesion;
      const mesa = ses?.attributes?.mesa?.data || ses?.mesa;
      const num = mesa?.attributes?.number ?? mesa?.number;

      const matchesTable = Number(num) === Number(table);
      const isNotCancelled = a.order_status !== 'cancelled';
      return matchesTable && isNotCancelled;
    });

    console.log(`🔍 fetchOrderDetails filtered for table ${table}: ${ordersForTable.length}`);

    // Formatear pedidos con items
    return ordersForTable.map((row) => {
      const a = row.attributes || row;

      let itemsRaw = a.items?.data || a.items || [];
      if (!Array.isArray(itemsRaw)) {
        itemsRaw = [];
      }

      const items = itemsRaw.map((item, idx) => {
        const itemAttr = item.attributes || item;
        const product = itemAttr.product?.data || itemAttr.product || item.product?.data || item.product;
        const productAttr = product?.attributes || product || {};

        const itemId = item.id || item.documentId || `item-${idx}`;
        const productName = productAttr?.name || itemAttr.product?.name || item.product?.name || 'Producto';
        const quantity = Number(itemAttr.quantity || itemAttr.qty || item.quantity || item.qty || 1);
        const unitPrice = Number(itemAttr.UnitPrice || itemAttr.unitPrice || itemAttr.price || productAttr?.price || 0);
        const totalPrice = Number(itemAttr.totalPrice || itemAttr.total_price || item.totalPrice || unitPrice * quantity);
        const notes = itemAttr.notes || item.notes || null;

        return {
          id: itemId,
          productId: product?.id || product?.documentId || productAttr?.id,
          name: productName,
          quantity,
          unitPrice,
          totalPrice,
          notes,
        };
      });

      return {
        id: row.id || row.documentId,
        order_status: a.order_status,
        total: Number(a.total || 0),
        customerNotes: a.customerNotes || null,
        createdAt: a.createdAt,
        items,
      };
    });
  } catch (err) {
    console.error('fetchOrderDetails error:', err?.response?.status, err?.response?.data || err?.message);
    return [];
  }
}
