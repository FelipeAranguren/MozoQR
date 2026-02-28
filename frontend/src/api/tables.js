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
 * Obtiene el nombre del restaurante por slug (público, ligero)
 */
export async function fetchRestaurantName(slug) {
  if (!slug) return null;
  try {
    const res = await publicHttp.get(`/restaurants/${slug}/menus`);
    return res?.data?.data?.restaurant?.name || null;
  } catch {
    return null;
  }
}

/**
 * Obtiene todas las mesas de un restaurante
 */
export async function fetchTables(slug) {
  if (!slug) return [];

  // ✅ Nuevo endpoint estable (source of truth) - público
  try {
    const res = await publicHttp.get(`/restaurants/${slug}/tables`);
    const rows = res?.data?.data || [];
    if (Array.isArray(rows)) {
      return rows
        .map((t) => ({
          id: t.id ?? t.documentId ?? t.number,
          number: Number(t.number),
          name: t.displayName || `Mesa ${t.number}`,
          displayName: t.displayName || `Mesa ${t.number}`,
          status: t.status || 'disponible',
          occupiedAt: t.occupiedAt || null,
        }))
        .sort((a, b) => (a.number || 0) - (b.number || 0));
    }
  } catch (_e) {
    // fall through to legacy strategies
  }

  // Método principal: obtener mesas desde el restaurante (más confiable)
  try {
    const timestamp = Date.now();
    const restauranteRes = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&populate[mesas]=true&fields[0]=id&_t=${timestamp}`
    );

    const restauranteData = restauranteRes?.data?.data?.[0];
    if (restauranteData) {
      const attr = restauranteData.attributes || restauranteData;
      const mesasData = attr.mesas?.data || attr.mesas || [];

      // Si hay mesas, retornarlas
      if (mesasData.length > 0) {
        const mesas = mesasData.map(item => {
          const mesaAttr = item.attributes || item;
          const mesaStatus = mesaAttr.status || 'disponible';
          const mesaNumber = mesaAttr.number || mesaAttr.numero || item.id;

          return {
            id: item.id || item.documentId,
            documentId: item.documentId,
            number: mesaNumber,
            name: mesaAttr.name || mesaAttr.displayName || `Mesa ${mesaNumber}`,
            displayName: mesaAttr.displayName || mesaAttr.name || `Mesa ${mesaNumber}`,
            status: mesaStatus
          };
        }).sort((a, b) => (a.number || 0) - (b.number || 0));

        // Filtrar duplicados: si hay múltiples mesas con el mismo número, usar solo la primera (más antigua por ID)
        const mesasUnicas = mesas.reduce((acc, mesa) => {
          const mesaNum = mesa.number;
          const existing = acc.find(m => m.number === mesaNum);
          if (!existing) {
            acc.push(mesa);
          } else {
            // Si encontramos un duplicado, mantener el que tiene el ID más bajo (más antiguo)
            if (mesa.id < existing.id) {
              const index = acc.indexOf(existing);
              acc[index] = mesa;
              console.warn(`[fetchTables] Mesa duplicada detectada: Mesa ${mesaNum}. Manteniendo la más antigua (ID: ${mesa.id})`);
            } else {
              console.warn(`[fetchTables] Mesa duplicada detectada: Mesa ${mesaNum} (ID: ${mesa.id}). Ya existe una más antigua (ID: ${existing.id})`);
            }
          }
          return acc;
        }, []);

        return mesasUnicas;
      }

      // Si no hay mesas pero el restaurante existe, retornar array vacío (válido)
      return [];
    }
  } catch (restErr) {
    // Si hay un error real, continuar con fallback
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
    const mesas = data.map(item => {
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

    // Filtrar duplicados: si hay múltiples mesas con el mismo número, usar solo la primera (más antigua por ID)
    const mesasUnicas = mesas.reduce((acc, mesa) => {
      const mesaNum = mesa.number;
      const existing = acc.find(m => m.number === mesaNum);
      if (!existing) {
        acc.push(mesa);
      } else {
        // Si encontramos un duplicado, mantener el que tiene el ID más bajo (más antiguo)
        if (mesa.id < existing.id) {
          const index = acc.indexOf(existing);
          acc[index] = mesa;
          console.warn(`[fetchTables] Mesa duplicada detectada: Mesa ${mesaNum}. Manteniendo la más antigua (ID: ${mesa.id})`);
        } else {
          console.warn(`[fetchTables] Mesa duplicada detectada: Mesa ${mesaNum} (ID: ${mesa.id}). Ya existe una más antigua (ID: ${existing.id})`);
        }
      }
      return acc;
    }, []);

    return mesasUnicas;
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
 * Claim (ocupar) una mesa de forma atómica.
 * body: { table, tableSessionId }
 */
export async function claimTable(slug, { table, tableSessionId }) {
  if (!slug) throw new Error('slug requerido');
  if (!table) throw new Error('table requerido');
  if (!tableSessionId) throw new Error('tableSessionId requerido');

  const res = await publicHttp.post(`/restaurants/${slug}/tables/claim`, {
    data: { table: Number(table), tableSessionId: String(tableSessionId) },
  });
  return res?.data?.data || res?.data;
}

/**
 * Release (liberar) una mesa (idempotente).
 * body: { table, tableSessionId }
 */
export async function releaseTable(slug, { table, tableSessionId }) {
  if (!slug) throw new Error('slug requerido');
  if (!table) throw new Error('table requerido');
  if (!tableSessionId) throw new Error('tableSessionId requerido');

  const res = await publicHttp.post(`/restaurants/${slug}/tables/release`, {
    data: { table: Number(table), tableSessionId: String(tableSessionId) },
  });
  return res?.data?.data || res?.data;
}

/**
 * Obtiene el estado de una mesa (público).
 */
export async function fetchTable(slug, table) {
  if (!slug) throw new Error('slug requerido');
  if (!table) throw new Error('table requerido');
  const res = await publicHttp.get(`/restaurants/${slug}/tables/${Number(table)}`);
  return res?.data?.data || null;
}

/**
 * Obtiene pedidos activos (no pagados) de un restaurante.
 * Headers no-cache para evitar pedidos fantasma por caché.
 */
export async function fetchActiveOrders(slug) {
  if (!slug) return [];

  const noCacheHeaders = {
    ...getAuthHeaders(),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
  };

  try {
    const res = await api.get(
      `/pedidos?filters[restaurante][slug][$eq]=${slug}&filters[order_status][$ne]=paid&publicationState=preview&populate[mesa_sesion][populate]=mesa&sort[0]=createdAt:desc&pagination[pageSize]=200`,
      { headers: noCacheHeaders }
    );

    let data = res?.data?.data || [];
    // Unicidad por documentId: evitar tarjetas duplicadas si el API devuelve duplicados
    const seenDocIds = new Set();
    data = data.filter((item) => {
      const attr = item.attributes || item;
      const docId = attr.documentId ?? item.documentId;
      if (!docId) return true;
      if (seenDocIds.has(docId)) return false;
      seenDocIds.add(docId);
      return true;
    });

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
        documentId: attr.documentId ?? item.documentId,
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

/**
 * Libera todas las mesas (cierra sesiones vía close-session).
 * Usa close-session en loop en lugar de force-release-all (evita 403).
 */
export async function forceReleaseAllTables(slug) {
  if (!slug) throw new Error('slug requerido');
  const mesas = await fetchTables(slug);
  let liberadas = 0;
  for (const m of mesas) {
    try {
      await api.put(`/restaurants/${slug}/close-session`, { data: { table: m.number } });
      liberadas++;
    } catch (_e) {
      // continuar con las demás
    }
  }
  return { released: liberadas, total: mesas.length };
}

/**
 * RESETEA TODAS LAS MESAS (Debug Tool)
 * Borra todo y crea mesas 1-20 limpias.
 */
export async function resetTables(slug) {
  if (!slug) throw new Error('slug requerido');
  try {
    const res = await api.post(`/restaurants/${slug}/reset-tables`);
    return res.data;
  } catch (err) {
    console.error('Error resetting tables:', err);
    throw err;
  }
}

