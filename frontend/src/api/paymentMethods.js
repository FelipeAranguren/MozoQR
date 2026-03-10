import { client as api } from './client';

/**
 * Obtiene el método de pago Mercado Pago del restaurante desde el backend (metodos_pagos).
 * GET /restaurants/:slug/payment-method (requiere auth + ser owner).
 * El backend no devuelve mp_access_token por seguridad; usa has_access_token para mostrar placeholder (••••••••).
 * @param {string} slug - Slug del restaurante
 * @returns {Promise<{ id, documentId, mp_public_key, has_access_token }|null>}
 */
export async function fetchMercadoPagoMethodBySlug(slug) {
  if (!slug) return null;
  const res = await api.get(`/restaurants/${slug}/payment-method`);
  const data = res?.data?.data;
  if (data == null) return null;
  return {
    id: data.id,
    documentId: data.documentId || data.id,
    mp_public_key: (data.mp_public_key != null && data.mp_public_key !== undefined) ? String(data.mp_public_key) : '',
    has_access_token: Boolean(data.has_access_token),
  };
}

/**
 * Guarda (upsert) credenciales Mercado Pago: actualiza el registro existente o crea uno nuevo.
 * PUT /restaurants/:slug/payment-method (requiere auth + ser owner).
 * @param {string} slug - Slug del restaurante
 * @param {object} payload - { mp_public_key, mp_access_token? }
 */
export async function saveMercadoPagoMethodBySlug(slug, { mp_public_key, mp_access_token }) {
  if (!slug) throw new Error('Slug requerido');
  const res = await api.put(`/restaurants/${slug}/payment-method`, {
    data: {
      mp_public_key: mp_public_key != null ? String(mp_public_key).trim() : null,
      ...(mp_access_token != null && String(mp_access_token).trim() !== '' ? { mp_access_token: String(mp_access_token).trim() } : {}),
    },
  });
  return res?.data ?? res;
}
