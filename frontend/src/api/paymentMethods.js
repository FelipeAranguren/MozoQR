import { client } from './client';

/**
 * Detecta si un valor parece ser un documentId de Strapi v5 (string alfanumérico ~25 chars).
 */
function isDocumentId(val) {
  return typeof val === 'string' && /^[a-z0-9]{25}$/i.test(val.trim());
}

/**
 * Obtiene (si existe) el método de pago Mercado Pago para un restaurante.
 * Solo expone mp_public_key; mp_access_token es write-only y no se devuelve desde el backend.
 * @param {string|number} restaurantIdentifier - documentId (Strapi v5) o id numérico (Strapi v4)
 */
export async function fetchMercadoPagoMethod(restaurantIdentifier) {
  if (restaurantIdentifier == null) return null;
  const params = { 'filters[provider][$eq]': 'mercado_pago' };
  // Strapi v5: filtrar por documentId de la relación
  if (isDocumentId(restaurantIdentifier)) {
    params['filters[restaurante][documentId][$eq]'] = restaurantIdentifier;
  } else {
    params['filters[restaurante][$eq]'] = restaurantIdentifier;
  }
  const res = await client.get('/metodos-pagos', { params });

  const data = res?.data?.data || [];
  const first = data[0];
  if (!first) return null;
  const attr = first.attributes || first;

  return {
    id: first.id,
    documentId: first.documentId || first.id,
    mp_public_key: attr.mp_public_key || '',
  };
}

/**
 * Crea o actualiza el método Mercado Pago para un restaurante.
 * - provider fijo: 'mercado_pago'
 * - active se fuerza a true
 * - mp_access_token es write-only: si viene vacío no se modifica el existente
 * - Strapi v5 requiere documentId para la relación restaurante y para la URL de PUT
 */
export async function saveMercadoPagoMethod({
  restaurantDocumentId,
  restaurantId,
  metodoDocumentId,
  metodoId,
  mp_public_key,
  mp_access_token,
}) {
  const restId = restaurantDocumentId ?? restaurantId;
  if (!restId) {
    throw new Error('restaurantDocumentId o restaurantId requerido para guardar credenciales de Mercado Pago');
  }

  // Strapi v5: la relación manyToOne acepta documentId directamente; v4 acepta id numérico

  const payload = {
    data: {
      provider: 'mercado_pago',
      mp_public_key: mp_public_key || null,
      active: true,
      restaurante: restId,
      ...(mp_access_token ? { mp_access_token } : {}),
    },
  };

  const metodoIdentifier = metodoDocumentId ?? metodoId;
  if (metodoIdentifier) {
    await client.put(`/metodos-pagos/${metodoIdentifier}`, payload);
  } else {
    await client.post('/metodos-pagos', payload);
  }
}

