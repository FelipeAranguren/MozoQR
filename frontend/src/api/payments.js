import { client, unwrap } from './client';

/**
 * Consulta si Mercado Pago está disponible para un restaurante (por MetodosPago o por fallback .env).
 * @param {string} slug - Slug del restaurante
 * @returns {Promise<{ available: boolean, fallback?: boolean }>}
 */
export async function getMercadoPagoAvailable(slug) {
  if (!slug) return { available: false };
  try {
    const res = await client.get('/payments/mercado-pago-available', { params: { slug } });
    const data = res?.data;
    return {
      available: Boolean(data?.available),
      fallback: Boolean(data?.fallback),
    };
  } catch (e) {
    return { available: false };
  }
}

/**
 * Crea una preferencia de pago en el backend.
 * Respuesta exitosa: { ok: true, preference_id, init_point, sandbox_init_point, payment_id }.
 * Si la petición falla (response.ok falso o error de red), no se accede a data.config ni a otras propiedades.
 */
export async function createMpPreference({ orderId, amount, items, cartItems, payer_email, back_urls, slug }) {
  let res;
  try {
    res = await client.post('/payments/create-preference', {
      orderId,
      amount,
      items,
      cartItems,
      payer_email,
      back_urls,
      slug,
    });
  } catch (e) {
    const responseData = e?.response?.data;
    const serverMsg = responseData && typeof responseData.error === 'string' ? responseData.error : null;
    const fallbackMsg = e && typeof e.message === 'string' ? e.message : null;
    const message = serverMsg || fallbackMsg || 'No se pudo conectar con el servidor de pagos. Intentá de nuevo en unos segundos.';
    throw new Error(message);
  }

  if (!res || res.status !== 200) {
    throw new Error(res?.data?.error || 'Error al generar la preferencia.');
  }
  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new Error('El servidor no devolvió una respuesta válida. Intentá de nuevo.');
  }
  if (data.ok === false || !data.ok) {
    const msg = (typeof data.error === 'string' && data.error) || 'Error al generar la preferencia.';
    throw new Error(msg);
  }
  return data;
}

/**
 * Crea una preferencia de pago para suscripción (plan Básico, Pro o Ultra).
 * Usa credenciales del restaurante 'Personal'; el monto lo calcula el backend (plan × dólar blue).
 * @param {{ plan: string }} - plan: slug (basic, pro, ultra) o nombre (Básico, Pro, Ultra)
 * @returns {Promise<{ ok: true, init_point: string, sandbox_init_point?: string, preference_id?: string }>}
 */
export async function createSubscriptionPreference({ plan }) {
  let res;
  try {
    res = await client.post('/payments/create-subscription-preference', { plan });
  } catch (e) {
    const responseData = e?.response?.data;
    const serverMsg = responseData && typeof responseData.error === 'string' ? responseData.error : null;
    const fallbackMsg = e && typeof e.message === 'string' ? e.message : null;
    const message =
      serverMsg ||
      fallbackMsg ||
      'No se pudo conectar con el servidor de pagos. Intentá de nuevo en unos segundos.';
    throw new Error(message);
  }

  if (!res || res.status !== 200) {
    throw new Error(res?.data?.error || 'Error al generar el link de pago.');
  }
  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new Error('El servidor no devolvió una respuesta válida. Intentá de nuevo.');
  }
  if (data.ok === false || !data.ok) {
    const msg = (typeof data.error === 'string' && data.error) || 'Error al generar el link de pago.';
    throw new Error(msg);
  }
  const initPoint = data.init_point || data.sandbox_init_point;
  if (!initPoint) {
    throw new Error('El servidor no devolvió el link de Mercado Pago. Intentá de nuevo.');
  }
  return { ...data, init_point: initPoint };
}

/**
 * Post payment (mock/manual)
 */
export async function postPayment(
  slug,
  { orderId, status = 'approved', amount, provider, externalRef }
) {
  const res = await client.post(`/restaurants/${slug}/payments`, {
    data: { orderId, status, amount, provider, externalRef },
  });
  return unwrap(res);
}

/**
 * Crea un checkout de Mobbex en el backend.
 * Espera que el backend devuelva { ok: true, checkoutUrl }.
 */
export async function createMobbexCheckout({
  total,
  reference,
  cardType,
  cardBrand,
  slug,
  table,
  tableSessionId,
}) {
  let res;
  try {
    res = await client.post('/mobbex/checkout', {
      total,
      reference,
      cardType,
      cardBrand,
      slug,
      table,
      tableSessionId,
    });
  } catch (e) {
    const responseData = e?.response?.data;
    const serverMsg =
      responseData && typeof responseData.error === 'string' ? responseData.error : null;
    const fallbackMsg = e && typeof e.message === 'string' ? e.message : null;
    const message =
      serverMsg ||
      fallbackMsg ||
      'No se pudo conectar con el servidor de pagos (Mobbex). Intentá de nuevo en unos segundos.';
    throw new Error(message);
  }

  if (!res || res.status !== 200) {
    throw new Error(res?.data?.error || 'Error al generar el checkout de Mobbex.');
  }

  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new Error('El servidor no devolvió una respuesta válida para Mobbex.');
  }
  if (data.ok === false || !data.ok) {
    const msg =
      (typeof data.error === 'string' && data.error) ||
      'Error al generar el checkout de Mobbex.';
    throw new Error(msg);
  }

  if (!data.checkoutUrl) {
    throw new Error('La respuesta de Mobbex no incluye la URL de pago.');
  }

  return data;
}


