// src/api/payments.js
const BASE_URL = import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337';

export async function createMpPreference({ orderId, amount, items, payer_email, back_urls }) {
  const res = await fetch(`${BASE_URL}/api/mercadopago/create-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, amount, items, payer_email, back_urls })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`MP create-preference failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  if (!data?.ok) {
    throw new Error(data?.error || 'Error creando preferencia.');
  }
  return data; // { ok, preference_id, init_point, sandbox_init_point, payment_id }
}
