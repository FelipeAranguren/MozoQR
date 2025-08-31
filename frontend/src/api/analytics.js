// src/api/analytics.js
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:1337";

function withQuery(url, params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, v);
  });
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * GET /api/restaurantes/:slug/products-per-day
 * Devuelve [{ date, quantity }, ...]
 */
export async function fetchProductsPerDay({ slug, from, to, status }) {
  const url = withQuery(
    `${BASE_URL}/api/restaurantes/${slug}/products-per-day`,
    { from, to, status }
  );

  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.data || json;
  return Array.isArray(data?.series) ? data.series : [];
}
