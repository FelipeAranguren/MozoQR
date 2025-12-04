import { api } from '../api';
import axios from 'axios';

const baseURL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';
const publicHttp = axios.create({ baseURL });

// Helper para obtener token de autenticación
function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Obtiene todas las mesas de un restaurante
 */
export async function fetchTables(slug) {
  if (!slug) return [];

  // Método principal: obtener mesas desde el restaurante (más confiable)
  try {
    const restauranteRes = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&populate[mesas]=true&fields[0]=id`
    );

    const restauranteData = restauranteRes?.data?.data?.[0];
    if (restauranteData) {
      const attr = restauranteData.attributes || restauranteData;
      const mesasData = attr.mesas?.data || attr.mesas || [];

      // Debug: log para ver qué estamos obteniendo
      if (mesasData.length > 0) {
        console.log(`[tables.js] Obtenidas ${mesasData.length} mesas desde restaurante para ${slug}`);
      }

      // Si hay mesas, retornarlas
      if (mesasData.length > 0) {
        const mesas = mesasData.map(item => {
          const mesaAttr = item.attributes || item;
          return {
            id: item.id || item.documentId,
            documentId: item.documentId,
            number: mesaAttr.number || mesaAttr.numero || item.id,
            name: mesaAttr.name || mesaAttr.displayName || `Mesa ${mesaAttr.number || item.id}`,
            displayName: mesaAttr.displayName || mesaAttr.name || `Mesa ${mesaAttr.number || item.id}`,
            status: mesaAttr.status || 'disponible'
          };
        }).sort((a, b) => (a.number || 0) - (b.number || 0));

        return mesas;
      }

      // Si no hay mesas pero el restaurante existe, retornar array vacío (válido)
      console.log(`[tables.js] Restaurante ${slug} encontrado pero sin mesas`);
      return [];
    } else {
      console.warn(`[tables.js] Restaurante ${slug} no encontrado`);
    }
  } catch (restErr) {
    // Si hay un error real (no solo que no hay mesas), loguearlo pero continuar con fallback
    console.warn('[tables.js] Error al obtener mesas desde restaurante:', restErr?.response?.status || restErr?.message);
  }

  // Fallback: intentar endpoint directo de mesas (solo si el método principal no funcionó)
  // Este método puede dar 403 si no hay permisos, pero es mejor intentarlo como último recurso
  try {
    const restauranteId = await getRestaurantId(slug);
    if (!restauranteId) {
      // Si no encontramos el restaurante, retornar vacío
      return [];
    }

    const res = await api.get(
      `/mesas?filters[restaurante][id][$eq]=${restauranteId}&fields[0]=id&fields[1]=number&fields[2]=name&fields[3]=displayName&fields[4]=status&sort[0]=number:asc`
    );

    const data = res?.data?.data || [];
    return data.map(item => {
      const attr = item.attributes || item;
      return {
        id: item.id || item.documentId,
        documentId: item.documentId,
        number: attr.number || attr.numero || item.id,
        name: attr.name || attr.displayName || `Mesa ${attr.number || item.id}`,
        displayName: attr.displayName || attr.name || `Mesa ${attr.number || item.id}`,
        status: attr.status || 'disponible'
      };
    });
  } catch (err) {
    // Si el fallback también falla, solo loguear si no es 403 (403 es esperado si no hay permisos)
    if (err?.response?.status === 403) {
      // Error 403 es esperado si el usuario no tiene permisos para el endpoint directo
      // Pero ya intentamos el método principal, así que solo retornar vacío sin loguear
      return [];
    }
    // Para otros errores, loguear pero retornar vacío
    console.warn('[tables.js] Error en fallback de mesas:', err?.response?.status || err?.message);
    return [];
  }
}

/**
 * Obtiene pedidos activos (no pagados) de un restaurante
 */
export async function fetchActiveOrders(slug) {
  if (!slug) return [];

  try {
    const res = await api.get(
      `/pedidos?filters[restaurante][slug][$eq]=${slug}&filters[order_status][$ne]=paid&populate[mesa_sesion][populate]=mesa&sort[0]=createdAt:desc&pagination[pageSize]=200`,
      { headers: getAuthHeaders() }
    );

    const data = res?.data?.data || [];
    return data.map(item => {
      const attr = item.attributes || item;

      // Extraer número de mesa
      let mesaNumber = null;
      const mesaSesion = attr.mesa_sesion?.data || attr.mesa_sesion;
      if (mesaSesion) {
        const sesAttr = mesaSesion.attributes || mesaSesion;
        const mesa = sesAttr.mesa?.data || sesAttr.mesa;
        if (mesa) {
          const mesaAttr = mesa.attributes || mesa;
          mesaNumber = mesaAttr.number || mesaAttr.numero || mesa.number;
        }
      }

      return {
        id: item.id,
        order_status: attr.order_status,
        total: Number(attr.total || 0),
        createdAt: attr.createdAt,
        mesa: mesaNumber,
        tableNumber: mesaNumber
      };
    });
  } catch (err) {
    console.error('Error fetching active orders:', err);
    return [];
  }
}

/**
 * Obtiene el ID del restaurante desde el slug
 */
async function getRestaurantId(slug) {
  if (!slug) return null;

  try {
    // Usar api en lugar de publicHttp para incluir autenticación automática
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id`
    );

    const data = res?.data?.data?.[0];
    return data?.id || data?.documentId || null;
  } catch (err) {
    console.error('Error fetching restaurant ID:', err);
    return null;
  }
}

/**
 * Crea una mesa
 */
export async function createTable(slug, tableData) {
  if (!slug) throw new Error('slug requerido');

  const restauranteId = await getRestaurantId(slug);
  if (!restauranteId) throw new Error('Restaurante no encontrado');

  try {
    const payload = {
      data: {
        number: Number(tableData.number),
        name: tableData.name || `Mesa ${tableData.number}`,
        displayName: tableData.displayName || tableData.name || `Mesa ${tableData.number}`,
        restaurante: restauranteId,
        isActive: true,
        publishedAt: new Date().toISOString() // Necesario para draftAndPublish
      }
    };

    // api ya incluye el token automáticamente por el interceptor
    const res = await api.post('/mesas', payload);
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error creating table:', err);
    // Mejorar el mensaje de error
    if (err?.response?.status === 403) {
      throw new Error('No tienes permisos para crear mesas. Verifica que estés autenticado correctamente.');
    }
    throw err;
  }
}

/**
 * Actualiza una mesa
 */
export async function updateTable(tableId, tableData) {
  if (!tableId) throw new Error('tableId requerido');

  try {
    const payload = {
      data: {
        ...(tableData.number !== undefined && { number: Number(tableData.number) }),
        ...(tableData.name !== undefined && { name: tableData.name }),
        ...(tableData.displayName !== undefined && { displayName: tableData.displayName })
      }
    };

    // api ya incluye el token automáticamente por el interceptor
    const res = await api.put(`/mesas/${tableId}`, payload);
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error updating table:', err);
    if (err?.response?.status === 403) {
      throw new Error('No tienes permisos para actualizar mesas.');
    }
    throw err;
  }
}

/**
 * Elimina una mesa
 */
export async function deleteTable(tableId) {
  if (!tableId) throw new Error('tableId requerido');

  try {
    // api ya incluye el token automáticamente por el interceptor
    await api.delete(`/mesas/${tableId}`);
    return true;
  } catch (err) {
    console.error('Error deleting table:', err);
    if (err?.response?.status === 403) {
      throw new Error('No tienes permisos para eliminar mesas.');
    }
    throw err;
  }
}

