import { client, unwrap } from './client';

export async function createMpPreference({ orderId, amount, items, payer_email, back_urls, slug }) {
  const res = await client.post('/payments/create-preference', {
    orderId, amount, items, payer_email, back_urls, slug,
  });

  const data = res.data;
  if (!data?.ok) {
    throw new Error(data?.error || 'Error creando preferencia.');
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

