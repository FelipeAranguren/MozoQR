// frontend/src/http.js
import axios from 'axios';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

export const http = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
});

/** 👉 Interceptor: agrega JWT si existe en localStorage */
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt'); // ajustá la key según tu login
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Helper to unwrap Strapi { data } */
function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/** PUBLIC: Menus */
export async function fetchMenus(slug) {
  const res = await http.get(`/restaurants/${slug}/menus`);
  return unwrap(res);
}

/** PUBLIC: Create order */
export async function createOrder(
  slug,
  { table, tableSessionId, items, notes, clientRequestId }
) {
  const res = await http.post(`/restaurants/${slug}/orders`, {
    data: { table, tableSessionId, items, notes, clientRequestId },
  });
  return unwrap(res);
}

/** PUBLIC: Payments (mock) */
export async function postPayment(
  slug,
  { orderId, status = 'approved', amount, provider, externalRef }
) {
  const res = await http.post(`/restaurants/${slug}/payments`, {
    data: { orderId, status, amount, provider, externalRef },
  });
  return unwrap(res);
}

/** STAFF/OWNER: List orders (polling) */
export async function listOrders(slug, { status, table, since } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (table) params.set('table', String(table));
  if (since) params.set('since', since);
  const res = await http.get(
    `/restaurants/${slug}/orders?` + params.toString()
  );
  return unwrap(res);
}

/** STAFF: Update order status */
export async function patchOrderStatus(slug, orderId, status) {
  const res = await http.patch(`/restaurants/${slug}/orders/${orderId}/status`, {
    data: { status },
  });
  return unwrap(res);
}

/** OWNER: KPIs */
export async function fetchKpis(slug) {
  const res = await http.get(`/restaurants/${slug}/kpis`);
  return unwrap(res);
}

/** OWNER: CSV export */
export function exportCsvUrl(slug, { start, end, status } = {}) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if (status) params.set('status', status);
  const url = `${API}/restaurants/${slug}/export?${params.toString()}`;
  return url;
}
