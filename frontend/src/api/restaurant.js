// frontend/src/api/restaurant.js
import { api } from '../api';
import { uploadImage } from './menu';

// Helper para obtener token de autenticación
function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper para limpiar y validar un ID de restaurante
function cleanRestaurantId(id) {
  if (id === null || id === undefined) return null;
  if (id === 0) return 0;
  
  // Si ya es un número válido
  if (typeof id === 'number' && !isNaN(id) && id > 0 && Number.isFinite(id)) {
    return Math.floor(id); // Asegurar que sea entero
  }
  
  // Convertir a string y extraer solo dígitos antes de cualquier ":"
  const idStr = String(id).trim();
  
  // Si el string contiene ":", tomar solo la parte antes del ":"
  const idPart = idStr.includes(':') ? idStr.split(':')[0] : idStr;
  
  // Extraer solo dígitos del inicio
  const digitsMatch = idPart.match(/^(\d+)/);
  
  if (!digitsMatch || !digitsMatch[1]) {
    console.error('cleanRestaurantId: No se encontraron dígitos válidos en:', { id, idStr, idPart });
    return null;
  }
  
  const numId = parseInt(digitsMatch[1], 10);
  if (isNaN(numId) || numId <= 0 || !Number.isFinite(numId)) {
    console.error('cleanRestaurantId: ID inválido después de parsear:', { id, idStr, idPart, numId });
    return null;
  }
  
  console.log('cleanRestaurantId: ID limpiado exitosamente', { 
    original: id, 
    cleaned: numId,
    hadColon: idStr.includes(':')
  });
  
  return numId;
}

/**
 * Obtiene los datos del restaurante
 */
export async function fetchRestaurant(slug) {
  if (!slug) return null;

  try {
    // Agregar timestamp para evitar caché del navegador, especialmente útil después de actualizar el logo
    const timestamp = Date.now();
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&populate[logo]=true&populate[metodos_pagos]=true&_t=${timestamp}`,
      { headers: getAuthHeaders() }
    );
    
    const data = res?.data?.data?.[0];
    if (!data) return null;
    
    const attr = data.attributes || data;
    const logo = attr.logo?.data || attr.logo;
    
    // Construir URL completa del logo
    let logoUrl = null;
    let logoId = null;
    
    if (logo && logo !== null) {
      const baseURL = import.meta.env?.VITE_API_URL?.replace('/api', '') || '';
      const logoAttrs = logo.attributes || logo;
      
      // Obtener el ID del logo
      logoId = logo.id || logo.documentId || logoAttrs?.id || logoAttrs?.documentId || null;
      
      // Construir URL - intentar diferentes formatos
      let urlRelative = null;
      if (typeof logo === 'string') {
        urlRelative = logo;
      } else if (logoAttrs) {
        // Intentar diferentes formatos de imagen (small, thumbnail, o la original)
        urlRelative = 
          logoAttrs.formats?.small?.url ||
          logoAttrs.formats?.thumbnail?.url ||
          logoAttrs.formats?.medium?.url ||
          logoAttrs.url ||
          logo.url;
      } else if (logo.url) {
        urlRelative = logo.url;
      }
      
      if (urlRelative) {
        logoUrl = urlRelative.startsWith('http') 
          ? urlRelative 
          : baseURL + urlRelative;
      }
    }
    
    // Extraer ID numérico correctamente - en Strapi v4, el ID numérico está directamente en data.id
    // Asegurarse de extraer solo el número, sin formato adicional
    let restaurantId = data.id;
    
    // Si es un string, intentar convertir a número
    if (typeof restaurantId === 'string') {
      // Extraer solo números del string (por si viene con formato extraño)
      const numMatch = restaurantId.match(/\d+/);
      restaurantId = numMatch ? parseInt(numMatch[0], 10) : null;
    }
    
    // Validar que sea un número válido
    if (restaurantId && (typeof restaurantId !== 'number' || isNaN(restaurantId))) {
      console.error('fetchRestaurant: ID inválido encontrado:', { original: data.id, processed: restaurantId, data });
      restaurantId = null;
    }
    
    const documentIdValue = data.documentId || null;

    if (!restaurantId && !documentIdValue) {
      console.error('fetchRestaurant: No se encontró ID ni documentId en la respuesta:', data);
    }

    // mp_public_key y métodos de pago desde MetodosPago (nunca exponer mp_access_token al cliente)
    const metodosPagos = attr.metodos_pagos?.data ?? attr.metodos_pagos ?? [];
    const list = Array.isArray(metodosPagos) ? metodosPagos : [];
    const mpMethod = list.find((m) => (m.attributes?.provider ?? m.provider) === 'mercado_pago' && (m.attributes?.active ?? m.active));
    const mpPublicKey = mpMethod ? (mpMethod.attributes?.mp_public_key ?? mpMethod.mp_public_key ?? null) : null;
    const hasMercadoPago = Boolean(mpPublicKey);

    return {
      id: restaurantId || documentIdValue,
      documentId: documentIdValue,
      name: attr.name || '',
      slug: attr.slug || '',
      logo: logoUrl,
      logoId: logoId,
      suscripcion: attr.Suscripcion || attr.suscripcion || 'BASIC',
      mp_public_key: mpPublicKey,
      hasMercadoPago,
      metodos_pagos: list.map((m) => {
        const a = m.attributes || m;
        return { provider: a.provider, active: a.active, mp_public_key: a.mp_public_key, alias_cbu: a.alias_cbu };
      }),
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
/**
 * Limpia sesiones antiguas del restaurante
 * @param {string} slug - Slug del restaurante
 * @param {object} options - Opciones de limpieza { daysOpen: 7, daysClosed: 30 }
 * @returns {Promise<object>} Resultado de la limpieza
 */
export async function cleanOldSessions(slug, options = {}) {
  const { daysOpen = 7, daysClosed = 30 } = options;
  
  try {
    const res = await api.post(`/restaurants/${slug}/cleanup/old-sessions`, {
      daysOpen,
      daysClosed,
    });
    return res?.data || res;
  } catch (err) {
    console.error('Error limpiando sesiones antiguas:', err?.response?.data || err);
    throw err;
  }
}

export async function updateRestaurant(slug, restaurantData) {
  if (!slug) throw new Error('slug requerido');

  try {
    // Obtener el ID directamente desde la API sin funciones intermedias
    const fetchRes = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}`,
      { headers: getAuthHeaders() }
    );
    
    const data = fetchRes?.data?.data?.[0];
    if (!data) {
      throw new Error('Restaurante no encontrado');
    }

    // Log detallado de la respuesta completa para debug
    console.log('🔍 updateRestaurant: Respuesta completa de la API', {
      dataKeys: Object.keys(data || {}),
      dataId: data.id,
      dataIdType: typeof data.id,
      dataDocumentId: data.documentId,
      dataAttributes: data.attributes ? Object.keys(data.attributes) : null,
      fullData: JSON.parse(JSON.stringify(data)) // Clonar para evitar problemas de referencia
    });

    // Extraer el ID numérico directamente desde la respuesta
    let restaurantId = data.id || (data.attributes && data.attributes.id);
    
    console.log('🔍 updateRestaurant: ID extraído de la respuesta', {
      restaurantId,
      restaurantIdType: typeof restaurantId,
      restaurantIdString: String(restaurantId),
      restaurantIdJSON: JSON.stringify(restaurantId),
      hasColon: String(restaurantId).includes(':'),
      dataId: data.id,
      dataIdType: typeof data.id
    });
    
    if (!restaurantId) {
      console.error('updateRestaurant: No se encontró ID en la respuesta', data);
      throw new Error('No se pudo obtener el ID del restaurante');
    }

    // Limpiar el ID usando la función helper
    const numericId = cleanRestaurantId(restaurantId);
    
    if (!numericId) {
      console.error('updateRestaurant: No se pudo limpiar el ID', { 
        original: restaurantId,
        originalType: typeof restaurantId,
        data
      });
      throw new Error(`ID de restaurante inválido o con formato no soportado: ${restaurantId}`);
    }

    console.log('updateRestaurant: ID obtenido y limpiado', { 
      originalId: restaurantId,
      originalType: typeof restaurantId,
      numericId,
      numericIdType: typeof numericId,
      slug
    });

    // Manejar el logo: subir nuevo, eliminar, o mantener el actual
    let logoUpdate = undefined; // undefined = no cambiar, null = eliminar, id = nuevo logo
    if (restaurantData.logoFile) {
      // Nueva imagen: subirla
      const uploaded = await uploadImage(restaurantData.logoFile);
      logoUpdate = uploaded?.id || null;
    } else if (restaurantData.removeLogo === true) {
      // Se quiere eliminar el logo explícitamente
      logoUpdate = null;
    }
    // Si logoUpdate es undefined, no incluimos el campo logo en el payload (mantener el actual)

    // Campos de pago (mp_*, cbu, etc.) se gestionan en MetodosPago, no en Restaurante
    const payload = {
      data: {
        ...(restaurantData.name !== undefined && { name: restaurantData.name }),
        ...(logoUpdate !== undefined && { logo: logoUpdate })
      }
    };

    // Construir URL de forma segura usando el ID numérico limpio
    // Forzar que numericId sea un número entero válido
    const finalId = Number(numericId);
    if (isNaN(finalId) || finalId <= 0 || !Number.isInteger(finalId)) {
      console.error('⚠️ ERROR: ID final no es un número entero válido:', {
        numericId,
        finalId,
        type: typeof numericId
      });
      throw new Error(`ID inválido: ${numericId} -> ${finalId}`);
    }
    
    // Construir la URL asegurándonos de que solo tenga el número
    const urlPath = `/restaurantes/${finalId}`;
    
    // Validar que la URL no tenga caracteres extraños antes de hacer la petición
    const urlPathStr = String(urlPath);
    if (urlPathStr.includes(':') && !urlPathStr.startsWith('http')) {
      console.error('⚠️ ERROR: La URL contiene ":" lo cual es inválido:', {
        urlPath,
        urlPathStr,
        numericId,
        finalId,
        numericIdType: typeof numericId,
        finalIdType: typeof finalId
      });
      throw new Error(`URL inválida generada: ${urlPath}`);
    }
    
    // Log final con todos los detalles antes de hacer la petición
    console.log('🚀 updateRestaurant: Listo para enviar petición', {
      numericId,
      finalId,
      numericIdType: typeof numericId,
      finalIdType: typeof finalId,
      numericIdString: String(numericId),
      finalIdString: String(finalId),
      urlPath,
      urlPathStr,
      urlPathLength: urlPath.length,
      slug,
      logoUpdate,
      payloadKeys: Object.keys(payload.data || {}),
      baseURL: api.defaults?.baseURL
    });

    const res = await api.put(urlPath, payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error updating restaurant:', err);
    console.error('Error details:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    throw err;
  }
}
