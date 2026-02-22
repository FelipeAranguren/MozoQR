import { client, unwrap } from './client';

/**
 * Crea una preferencia de pago en el backend.
 * Respuesta exitosa: { ok: true, preference_id, init_point, sandbox_init_point, payment_id }.
 * Nunca accede a .config u otras propiedades sin comprobar antes; evita crashes si el servidor falla.
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

  const data = res && res.data;
  if (!data || typeof data !== 'object') {
    throw new Error('El servidor no devolvió una respuesta válida. Intentá de nuevo.');
  }
  if (!data.ok) {
    throw new Error(
      (data && typeof data.error === 'string' && data.error) || 'Error creando preferencia.',
    );
  }
  return data; // { ok, preference_id, init_point, sandbox_init_point, payment_id }
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

