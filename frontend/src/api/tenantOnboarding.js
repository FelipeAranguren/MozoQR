const API_BASE = (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_STRAPI_URL || 'http://localhost:1337/api').replace(/\/api\/?$/, '');

export async function onboardingRestaurant(payload) {
  const res = await fetch(`${API_BASE}/api/tenant/onboarding-restaurant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
    credentials: 'include',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      json?.error?.message ||
      json?.message ||
      (Array.isArray(json?.errors) && json.errors[0]?.message) ||
      'No se pudo crear el restaurante. Intentá de nuevo.';
    const code = json?.error?.code || json?.error?.name;
    const status = res.status;
    throw Object.assign(new Error(message), { status, code, details: json });
  }

  const data = json?.data || json;
  return data;
}

