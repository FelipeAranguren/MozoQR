import { client } from './client';

/**
 * Obtiene (si existe) el método de pago Mercado Pago para un restaurante.
 * Solo expone mp_public_key; mp_access_token es write-only y no se devuelve desde el backend.
 */
export async function fetchMercadoPagoMethod(restaurantId) {
  if (!restaurantId) return null;
  const res = await client.get('/metodos-pagos', {
    params: {
      'filters[restaurante][id][$eq]': restaurantId,
      'filters[provider][$eq]': 'mercado_pago',
    },
  });

  const data = res?.data?.data || [];
  const first = data[0];
  if (!first) return null;
  const attr = first.attributes || {};

  return {
    id: first.id,
    mp_public_key: attr.mp_public_key || '',
  };
}

/**
 * Crea o actualiza el método Mercado Pago para un restaurante.
 * - provider fijo: 'mercado_pago'
 * - active se fuerza a true
 * - mp_access_token es write-only: si viene vacío no se modifica el existente
 */
export async function saveMercadoPagoMethod({ restaurantId, metodoId, mp_public_key, mp_access_token }) {
  if (!restaurantId) {
    throw new Error('restaurantId requerido para guardar credenciales de Mercado Pago');
  }

  const payload = {
    data: {
      provider: 'mercado_pago',
      mp_public_key: mp_public_key || null,
      active: true,
      restaurante: restaurantId,
      // mp_access_token es privado y solo se envía si el usuario ingresa un valor nuevo
      ...(mp_access_token ? { mp_access_token } : {}),
    },
  };

  if (metodoId) {
    await client.put(`/metodos-pagos/${metodoId}`, payload);
  } else {
    await client.post('/metodos-pagos', payload);
  }
}

