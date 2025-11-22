// frontend/src/api/tables.js
import { api } from '../api';

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

  try {
    // Primero obtener el ID del restaurante
    const restauranteId = await getRestaurantId(slug);
    if (!restauranteId) {
      console.warn('No se encontró el restaurante con slug:', slug);
      return [];
    }

    const res = await api.get(
      `/mesas?filters[restaurante][id][$eq]=${restauranteId}&fields[0]=id&fields[1]=number&fields[2]=name&fields[3]=displayName&sort[0]=number:asc`,
      { headers: getAuthHeaders() }
    );
    
    const data = res?.data?.data || [];
    return data.map(item => {
      const attr = item.attributes || item;
      return {
        id: item.id || item.documentId,
        documentId: item.documentId,
        number: attr.number || attr.numero || item.id,
        name: attr.name || attr.displayName || `Mesa ${attr.number || item.id}`,
        displayName: attr.displayName || attr.name || `Mesa ${attr.number || item.id}`
      };
    });
  } catch (err) {
    console.error('Error fetching tables:', err);
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
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id`,
      { headers: getAuthHeaders() }
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
        restaurante: restauranteId
      }
    };

    const res = await api.post('/mesas', payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error creating table:', err);
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

    const res = await api.put(`/mesas/${tableId}`, payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error updating table:', err);
    throw err;
  }
}

/**
 * Elimina una mesa
 */
export async function deleteTable(tableId) {
  if (!tableId) throw new Error('tableId requerido');

  try {
    await api.delete(`/mesas/${tableId}`, { headers: getAuthHeaders() });
    return true;
  } catch (err) {
    console.error('Error deleting table:', err);
    throw err;
  }
}

