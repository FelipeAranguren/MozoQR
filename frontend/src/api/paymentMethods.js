import { client } from './client';

/**
 * Detecta si un valor parece ser un documentId de Strapi v5
 * (string alfanumérico de longitud típica 24, pero permitimos un rango).
 */
function isDocumentId(val) {
  const v = typeof val === 'string' ? val.trim() : '';
  return /^[a-z0-9]{20,40}$/i.test(v);
}

/**
 * Obtiene (si existe) el método de pago Mercado Pago para un restaurante.
 * Solo expone mp_public_key; mp_access_token es write-only y no se devuelve desde el backend.
 * @param {string|number} restaurantIdentifier - documentId (Strapi v5) o id numérico (Strapi v4)
 */
export async function fetchMercadoPagoMethod(restaurantIdentifier) {
  if (restaurantIdentifier == null) return null;
  const params = { 'filters[provider][$eq]': 'mercado_pago' };
  // Strapi v5: filtrar por documentId de la relación cuando el identificador no es claramente numérico
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
 * - Strapi v5 permite usar documentId para la relación restaurante y para la URL de PUT
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

  const payload = {
    data: {
      provider: 'mercado_pago',
      mp_public_key: mp_public_key || null,
      active: true,
      restaurante: restId,
      ...(mp_access_token ? { mp_access_token } : {}),
    },
  };

  // Para Strapi v5, priorizar siempre documentId para el PUT
  const metodoIdentifier = metodoDocumentId || metodoId;
  if (metodoIdentifier) {
    await client.put(`/metodos-pagos/${metodoIdentifier}`, payload);
  } else {
    await client.post('/metodos-pagos', payload);
  }
}

