import { client, unwrap } from './client';

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
  } catch (err) {
    const data = err?.response?.data;
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      (err && typeof err.message === 'string' && err.message) ||
      'No se pudo conectar con el servidor de pagos. Intentá de nuevo en unos segundos.';
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

