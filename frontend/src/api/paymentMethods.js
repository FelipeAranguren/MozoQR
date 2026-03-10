import { client as api } from './client';

/**
 * Obtiene el método de pago Mercado Pago para un restaurante por slug.
 * Usa el endpoint /restaurants/:slug/payment-method que devuelve mp_public_key y mp_access_token.
 * @param {string} slug - Slug del restaurante
 */
export async function fetchMercadoPagoMethodBySlug(slug) {
  if (!slug) return null;
  const res = await api.get(`/restaurants/${slug}/payment-method`);
  const data = res?.data?.data;
  if (!data) return null;
  return {
    id: data.id,
    documentId: data.documentId || data.id,
    mp_public_key: data.mp_public_key || '',
    mp_access_token: data.mp_access_token || '',
  };
}

/**
 * Actualiza el método Mercado Pago para un restaurante por slug.
 * Siempre actualiza el existente; si no existe, crea uno nuevo.
 * Nunca crea duplicados.
 * @param {string} slug - Slug del restaurante
 * @param {object} payload - { mp_public_key, mp_access_token? }
 */
export async function saveMercadoPagoMethodBySlug(slug, { mp_public_key, mp_access_token }) {
  if (!slug) throw new Error('Slug requerido');
  await api.put(`/restaurants/${slug}/payment-method`, {
    data: {
      mp_public_key: mp_public_key ?? null,
      ...(mp_access_token ? { mp_access_token } : {}),
    },
  });
}
