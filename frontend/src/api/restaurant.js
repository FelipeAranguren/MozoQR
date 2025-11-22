// frontend/src/api/restaurant.js
import { api } from '../api';
import { uploadImage } from './menu';

// Helper para obtener token de autenticación
function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Obtiene los datos del restaurante
 */
export async function fetchRestaurant(slug) {
  if (!slug) return null;

  try {
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&populate[logo]=true`,
      { headers: getAuthHeaders() }
    );
    
    const data = res?.data?.data?.[0];
    if (!data) return null;
    
    const attr = data.attributes || data;
    const logo = attr.logo?.data || attr.logo;
    
    // Construir URL completa del logo
    let logoUrl = null;
    if (logo) {
      const baseURL = import.meta.env?.VITE_API_URL?.replace('/api', '') || '';
      if (typeof logo === 'string') {
        logoUrl = logo.startsWith('http') ? logo : baseURL + logo;
      } else if (logo.attributes?.url) {
        logoUrl = logo.attributes.url.startsWith('http') 
          ? logo.attributes.url 
          : baseURL + logo.attributes.url;
      } else if (logo.url) {
        logoUrl = logo.url.startsWith('http') 
          ? logo.url 
          : baseURL + logo.url;
      }
    }
    
    return {
      id: data.id || data.documentId,
      documentId: data.documentId,
      name: attr.name || '',
      slug: attr.slug || '',
      logo: logoUrl,
      logoId: logo ? (logo.id || logo.documentId || logo) : null,
      suscripcion: attr.Suscripcion || attr.suscripcion || 'BASIC',
      mp_access_token: attr.mp_access_token || null,
      mp_public_key: attr.mp_public_key || null,
      cbu: attr.cbu || null,
      cuenta_bancaria: attr.cuenta_bancaria || null,
      createdAt: attr.createdAt || null,
      updatedAt: attr.updatedAt || null
    };
  } catch (err) {
    console.error('Error fetching restaurant:', err);
    return null;
  }
}

/**
 * Actualiza los datos del restaurante
 */
export async function updateRestaurant(slug, restaurantData) {
  if (!slug) throw new Error('slug requerido');

  try {
    // Primero obtener el ID del restaurante
    const restaurant = await fetchRestaurant(slug);
    if (!restaurant || !restaurant.id) {
      throw new Error('Restaurante no encontrado');
    }

    // Si hay una nueva imagen de logo, subirla
    let logoId = restaurant.logoId; // Mantener el logo actual por defecto
    if (restaurantData.logoFile) {
      // Nueva imagen: subirla
      const uploaded = await uploadImage(restaurantData.logoFile);
      logoId = uploaded?.id || null;
    } else if (restaurantData.removeLogo === true) {
      // Se quiere eliminar el logo
      logoId = null;
    }

    const payload = {
      data: {
        ...(restaurantData.name !== undefined && { name: restaurantData.name }),
        ...(logoId !== undefined && { logo: logoId || null }),
        ...(restaurantData.mp_access_token !== undefined && { mp_access_token: restaurantData.mp_access_token }),
        ...(restaurantData.mp_public_key !== undefined && { mp_public_key: restaurantData.mp_public_key }),
        ...(restaurantData.cbu !== undefined && { cbu: restaurantData.cbu }),
        ...(restaurantData.cuenta_bancaria !== undefined && { cuenta_bancaria: restaurantData.cuenta_bancaria })
      }
    };

    const res = await api.put(`/restaurantes/${restaurant.id}`, payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error updating restaurant:', err);
    throw err;
  }
}
