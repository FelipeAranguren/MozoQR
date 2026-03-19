import { api } from '../api';

const MENU_DESIGN_FIELDS = [
  'menu_design',
  'menuDesign',
  'design_version',
  'designVersion',
  'menu_layout',
  'menuLayout',
];

function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeMenuDesign(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (
    raw === 'v1' ||
    raw === 'classic' ||
    raw === 'clasico' ||
    raw === 'clásico' ||
    raw === 'diseno_clasico' ||
    raw === 'diseno-classic' ||
    raw === 'diseño clásico'
  ) {
    return 'v1';
  }
  return 'v2';
}

export function readMenuDesignFromRestaurant(restaurant) {
  const attrs = restaurant?.attributes || restaurant || {};
  const key = MENU_DESIGN_FIELDS.find((candidate) => attrs[candidate] != null);
  const value = key ? attrs[key] : null;
  return normalizeMenuDesign(value);
}

export async function fetchRestaurantMenuDesign(slug) {
  if (!slug) return 'v2';
  try {
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
      { headers: getAuthHeaders() }
    );
    const restaurant = res?.data?.data?.[0];
    return readMenuDesignFromRestaurant(restaurant);
  } catch (err) {
    console.warn('No se pudo leer diseño de menú, usando v2 por defecto:', err?.message || err);
    return 'v2';
  }
}

export async function updateRestaurantMenuDesign(slug, design) {
  if (!slug) throw new Error('slug requerido');
  const normalizedDesign = normalizeMenuDesign(design);

  const listRes = await api.get(
    `/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
    { headers: getAuthHeaders() }
  );
  const restaurant = listRes?.data?.data?.[0];
  if (!restaurant) throw new Error('Restaurante no encontrado');

  const attrs = restaurant?.attributes || restaurant || {};
  const restaurantId = restaurant?.id || restaurant?.documentId;
  if (!restaurantId) throw new Error('No se pudo obtener el ID del restaurante');

  const preferredField = MENU_DESIGN_FIELDS.find((candidate) => attrs[candidate] !== undefined) || 'menu_design';
  const fieldsToTry = [preferredField, ...MENU_DESIGN_FIELDS.filter((f) => f !== preferredField)];

  let lastError = null;
  for (const fieldName of fieldsToTry) {
    try {
      const res = await api.put(
        `/restaurantes/${restaurantId}`,
        { data: { [fieldName]: normalizedDesign } },
        { headers: getAuthHeaders() }
      );
      return res?.data?.data || null;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo guardar el diseño del menú');
}
