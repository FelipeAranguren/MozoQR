import { client } from './client';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:1337/api';

/**
 * Crea un comentario de dueño
 * @param {Object} data - Datos del comentario
 * @param {number} data.restaurantId - ID del restaurante
 * @param {string} data.restaurantName - Nombre del restaurante
 * @param {string} data.comment - Texto del comentario
 * @returns {Promise<Object>} Comentario creado
 */
export async function createOwnerComment({ restaurantId, restaurantName, comment }) {
  try {
    const response = await client.post('/owner-comments/owner/create', {
      data: {
        restaurantId,
        restaurantName,
        comment,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating owner comment:', error);
    throw error;
  }
}

/**
 * Obtiene todos los comentarios de dueños (para admin)
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} options.archived - Si true, solo devuelve archivados. Si false, solo no archivados. Si undefined, devuelve todos
 * @returns {Promise<Array>} Lista de comentarios
 */
export async function getAllOwnerComments(options = {}) {
  try {
    const { archived } = options;
    let url = '/owner-comments?populate=restaurante&sort[0]=createdAt:desc';
    
    if (archived !== undefined) {
      url += `&filters[archived][$eq]=${archived}`;
    }
    
    const response = await client.get(url);
    // Unwrap Strapi response
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching owner comments:', error);
    throw error;
  }
}

/**
 * Archiva o desarchiva un comentario
 * @param {number} commentId - ID del comentario
 * @returns {Promise<Object>} Comentario actualizado
 */
export async function toggleArchiveComment(commentId) {
  try {
    console.log('[comments] Intentando archivar comentario:', commentId);
    const response = await client.put(`/owner-comments/owner/${commentId}/archive`);
    console.log('[comments] Respuesta del servidor:', response.data);
    return response.data;
  } catch (error) {
    console.error('[comments] Error archiving comment:', error);
    console.error('[comments] Error response:', error.response?.data);
    console.error('[comments] Error status:', error.response?.status);
    throw error;
  }
}

