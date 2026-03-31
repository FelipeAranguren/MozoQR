import { client } from './client';
import { getStrapiPublicBase } from '../utils/strapiPublicBase';

// Helper para obtener token de autenticación
function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Helper para usar client en lugar de api/http
const api = client;
const http = client;

/** Strapi v4: res.data.data = []; v5: res.data = [] (lista). Devuelve siempre array. */
function unwrapCategoriasResponse(res) {
  const raw = res?.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

/**
 * Obtiene id numérico y documentId del restaurante por slug (para filtros en API).
 * Útil cuando Strapi 5 puede filtrar por id o por documentId.
 */
export async function getRestaurantIdAndDocId(slug) {
  if (!slug) return { id: null, documentId: null };
  try {
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${encodeURIComponent(slug)}&publicationState=live`,
      { headers: getAuthHeaders() }
    );
    const raw = res?.data;
    const allResults = Array.isArray(raw) ? raw : (raw?.data || []);
    const match = allResults.find(r => (r?.attributes?.slug ?? r?.slug) === slug);
    if (!match) {
      console.warn('⚠️ [getRestaurantIdAndDocId] No match para slug:', slug, 'results:', allResults?.length);
      return { id: null, documentId: null };
    }
    const id = (typeof match.id === 'number' && Number.isFinite(match.id)) ? match.id : null;
    const documentId = match.documentId ?? match?.attributes?.documentId ?? null;
    let numericId = id;
    if (numericId == null && documentId) {
      try {
        const singleRes = await api.get(`/restaurantes/${documentId}`, { headers: getAuthHeaders() });
        const single = singleRes?.data?.data ?? singleRes?.data;
        const singleId = single?.id ?? single?.attributes?.id;
        if (typeof singleId === 'number' && Number.isFinite(singleId)) numericId = singleId;
      } catch (_) { /* ignore */ }
    }
    if (numericId == null && typeof match.id === 'string' && /^\d+$/.test(match.id)) {
      numericId = parseInt(match.id, 10);
    }
    return { id: numericId, documentId: documentId || null };
  } catch (err) {
    console.error('❌ [getRestaurantIdAndDocId] Error:', err?.response?.data ?? err?.message);
    return { id: null, documentId: null };
  }
}

/**
 * Obtiene todas las categorías de un restaurante
 * Para el owner, siempre usa API directa para ver TODAS las categorías con TODOS los productos (incluidos no disponibles)
 * El endpoint público filtra por available=true, lo cual es correcto para clientes pero no para owners
 */
export async function fetchCategories(slug) {
  if (!slug) return [];

  // NOTA: NO usar el endpoint público /restaurants/menus porque filtra por available=true
  // El owner necesita ver TODOS los productos para poder gestionarlos (incluidos no disponibles)
  try {
    console.log('🔄 [fetchCategories] Obteniendo categorías para slug:', slug);
    const { id: restauranteId, documentId: restauranteDocId } = await getRestaurantIdAndDocId(slug);
    console.log('ID Restaurante detectado:', { id: restauranteId, documentId: restauranteDocId });
    if (!restauranteId && !restauranteDocId) {
      console.warn('❌ [fetchCategories] No se encontró el restaurante con slug:', slug);
      return [];
    }

    const buildParams = (useDocumentId) => {
      const params = new URLSearchParams();
      if (useDocumentId && restauranteDocId) {
        params.append('filters[restaurante][documentId][$eq]', restauranteDocId);
      } else if (restauranteId != null) {
        params.append('filters[restaurante][id][$eq]', String(restauranteId));
      } else if (restauranteDocId) {
        params.append('filters[restaurante][documentId][$eq]', restauranteDocId);
      }
      params.append('populate[0]', 'restaurante');
      params.append('populate[1]', 'productos');
      params.append('populate[productos][populate][0]', 'image');
      params.append('sort[0]', 'name:asc');
      return params;
    };

    // Sin headers personalizados para evitar CORS (Strapi-Response-Format no está en Access-Control-Allow-Headers)
    const headers = getAuthHeaders();

    // Strapi 5: intentar primero documentId (relaciones suelen usar documentId), luego id numérico
    let params = buildParams(!!restauranteDocId);
    let url = `/categorias?${params.toString()}`;
    console.log('🔄 [fetchCategories] URL (1ª petición):', url);

    let res = await api.get(url, { headers });
    let data = unwrapCategoriasResponse(res);
    console.log('Categorías recibidas:', data);
    console.log('Categorías recibidas (raw res.data):', res?.data);

    if (data.length === 0 && restauranteDocId && restauranteId != null) {
      params = buildParams(false);
      url = `/categorias?${params.toString()}`;
      console.log('🔄 [fetchCategories] Reintentando con filters[restaurante][id]:', url);
      res = await api.get(url, { headers: getAuthHeaders() });
      data = unwrapCategoriasResponse(res);
      console.log('Categorías recibidas (2ª petición):', data);
    }

    console.log('✅ [fetchCategories] Categorías obtenidas:', data.length);

    // Strapi 5: respuesta puede ser plana (item.name) o v4 (item.attributes.name). Mapear ambos.
    return data.map(item => {
      const attr = item.attributes ?? item;
      const numericId = item.id ?? attr?.id;
      const documentId = item.documentId ?? attr?.documentId;
      const categoryId = numericId ?? documentId;
      const name = item.name ?? attr?.name ?? '';
      const slug = attr?.slug ?? item.slug ?? '';
      const productosRaw = Array.isArray(item.productos)
        ? item.productos
        : Array.isArray(attr?.productos)
          ? attr.productos
          : (attr?.productos?.data ?? attr?.productos ?? []);

      const productos = productosRaw.map(p => {
        const pAttr = p.attributes ?? p;
        const description = Array.isArray(pAttr?.description)
          ? blocksToText(pAttr.description)
          : typeof pAttr?.description === 'string'
            ? pAttr.description
            : '';
        return {
          ...p,
          id: p.id ?? pAttr?.id,
          name: p.name ?? pAttr?.name ?? '',
          price: Number(pAttr?.price ?? p.price ?? 0),
          description,
          available: (pAttr?.available ?? p.available) !== false,
          image: pAttr?.image ?? p.image ?? null
        };
      });

      return {
        id: categoryId,
        documentId,
        numericId,
        name,
        slug,
        productos
      };
    });
  } catch (err) {
    console.error('❌ [fetchCategories] Error obteniendo categorías:', err);
    console.error('❌ [fetchCategories] Error details:', err?.response?.data || err?.message);
    return [];
  }
}

/**
 * Obtiene todos los productos de un restaurante
 * Para el owner, siempre usa API directa para ver TODOS los productos (incluidos no disponibles)
 * El endpoint público filtra por available=true, lo cual es correcto para clientes pero no para owners
 */
export async function fetchProducts(slug, categoryId = null) {
  if (!slug) return [];

  // NOTA: NO usar el endpoint público /restaurants/menus porque filtra por available=true
  // El owner necesita ver TODOS los productos para poder gestionarlos (incluidos no disponibles)
  // Siempre usar API directa para el owner

  // Usar API directa directamente (sin intentar endpoint público)
  try {
    console.log('🔄 [fetchProducts] Usando API directa para obtener TODOS los productos (incluidos no disponibles)...');
    const restauranteId = await getRestaurantId(slug);
    if (!restauranteId) {
      console.warn('❌ [fetchProducts] No se encontró el restaurante con slug:', slug);
      return [];
    }

    // Construir parámetros de consulta de forma segura
    // NOTA: No filtramos por available aquí porque el owner necesita ver todos los productos para poder editarlos
    const params = new URLSearchParams();
    params.append('filters[restaurante][id][$eq]', restauranteId);
    // No filtrar por available - el owner necesita ver todos los productos
    params.append('populate[image]', 'true');
    params.append('populate[categoria]', 'true');
    params.append('sort[0]', 'name:asc');

    if (categoryId) {
      // Asegurar id numérico para el filtro (Strapi filtra por id numérico en la relación)
      const numericCatId = typeof categoryId === 'number' && Number.isFinite(categoryId)
        ? categoryId
        : (typeof categoryId === 'string' && /^\d+$/.test(categoryId) ? Number(categoryId) : categoryId);
      params.append('filters[categoria][id][$eq]', numericCatId);
    }

    const url = `/productos?${params.toString()}`;
    console.log('🔄 [fetchProducts] URL:', url);

    const res = await api.get(url, { headers: getAuthHeaders() });

    const data = res?.data?.data || [];
    console.log('✅ [fetchProducts] Productos obtenidos de API directa (TODOS, incluidos no disponibles):', data.length);

    return mapProducts(data);
  } catch (err) {
    console.error('❌ [fetchProducts] Error obteniendo productos:', err);
    console.error('❌ [fetchProducts] Error response:', err?.response?.data);
    console.error('❌ [fetchProducts] Error status:', err?.response?.status);
    return [];
  }
}

// Helper para convertir Rich Text (Blocks) de Strapi a texto plano
function blocksToText(blocks) {
  if (!blocks) return '';
  if (typeof blocks === 'string') return blocks;
  if (!Array.isArray(blocks)) return '';

  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return '';
    return nodes
      .map((n) => {
        if (typeof n?.text === 'string') return n.text;
        if (Array.isArray(n?.children)) return walk(n.children);
        return '';
      })
      .join('');
  };
  return walk(blocks).replace(/\s+/g, ' ').trim();
}

// Helper para convertir texto plano a formato Blocks de Strapi
function textToBlocks(text) {
  if (!text || typeof text !== 'string') {
    return [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '' }
        ]
      }
    ];
  }

  return [
    {
      type: 'paragraph',
      children: [
        { type: 'text', text: text.trim() }
      ]
    }
  ];
}

// Helper para mapear productos
function mapProducts(data) {
  const baseURL = getStrapiPublicBase();

  console.log('mapProducts: recibidos', data.length, 'productos');
  if (data.length > 0) {
    console.log('mapProducts: ejemplo de producto raw:', data[0]);
  }

  // Filtrar valores null/undefined ANTES de mapear
  const validData = data.filter(item => item != null);
  if (validData.length !== data.length) {
    console.warn(`mapProducts: filtrados ${data.length - validData.length} productos null/undefined`);
  }

  const mapped = validData.map(item => {
    // Los productos pueden venir directamente desde categorías (sin attributes) o desde API (con attributes)
    const attr = item.attributes || item;

    // Asegurar que siempre tengamos un id válido
    const productId = item.id || item.documentId || attr?.id || attr?.documentId;
    if (!productId) {
      console.warn('Producto sin ID válido:', item);
      return null; // Retornar null para filtrar después
    }

    const image = attr?.image?.data || attr?.image || (typeof attr?.image === 'object' && attr?.image?.id ? attr.image : null);

    // Si el producto ya tiene categoriaId (viene de categorías), usarlo
    // Si no, intentar obtenerlo de la relación categoria
    let categoriaId = item.categoriaId || null;
    let categoriaName = item.categoriaName || null; // Usar categoriaName si viene desde categorías

    if (!categoriaId) {
      const categoria = attr?.categoria?.data || attr?.categoria;
      categoriaId = categoria ? (categoria.id || categoria.documentId || categoria) : null;
      categoriaName = categoria ? (categoria.attributes?.name || categoria.name || '') : null;
    }

    // Construir URL completa de la imagen
    let imageUrl = null;
    if (image) {
      if (typeof image === 'string') {
        imageUrl = image.startsWith('http') ? image : baseURL + image;
      } else if (image.attributes?.url) {
        imageUrl = image.attributes.url.startsWith('http')
          ? image.attributes.url
          : baseURL + image.attributes.url;
      } else if (image.url) {
        imageUrl = image.url.startsWith('http')
          ? image.url
          : baseURL + image.url;
      } else if (image.id) {
        // Si solo tenemos el ID de la imagen, construir URL
        imageUrl = `${baseURL}/uploads/${image.documentId || image.id}`;
      }
    }

    // Convertir descripción a texto plano si es un array (Rich Text)
    const description = Array.isArray(attr?.description)
      ? blocksToText(attr.description)
      : typeof attr?.description === 'string'
        ? attr.description
        : '';

    const mapped = {
      id: productId,
      documentId: item.documentId || attr?.documentId,
      name: attr?.name || '',
      price: Number(attr?.price || 0),
      description: description,
      available: attr?.available !== false,
      image: imageUrl,
      categoriaId: categoriaId,
      categoriaName: categoriaName
    };

    return mapped;
  }).filter(item => {
    // Filtrar productos sin ID válido o que sean null
    if (!item || !item.id) {
      console.warn('Filtrando producto inválido:', item);
      return false;
    }
    return true;
  });

  console.log('mapProducts: productos mapeados:', mapped.length);
  if (mapped.length > 0) {
    console.log('mapProducts: ejemplo de producto mapeado:', mapped[0]);
  }

  return mapped;
}

/**
 * Obtiene un producto por ID
 */
export async function fetchProduct(productId) {
  if (!productId) return null;

  try {
    const res = await api.get(
      `/productos/${productId}?populate[image,categoria,restaurante]=true`,
      { headers: getAuthHeaders() }
    );

    const item = res?.data?.data;
    if (!item) return null;

    const attr = item.attributes || item;
    const image = attr.image?.data || attr.image;
    const categoria = attr.categoria?.data || attr.categoria;
    const restaurante = attr.restaurante?.data || attr.restaurante;

    // Convertir descripción a texto plano si es un array (Rich Text)
    const description = Array.isArray(attr.description)
      ? blocksToText(attr.description)
      : typeof attr.description === 'string'
        ? attr.description
        : '';

    return {
      id: item.id,
      name: attr.name || '',
      price: Number(attr.price || 0),
      description: description,
      available: attr.available !== false,
      image: image ? (image.attributes?.url || image.url || image) : null,
      categoriaId: categoria ? (categoria.id || categoria) : null,
      categoriaName: categoria ? (categoria.attributes?.name || categoria.name || '') : null,
      restauranteId: restaurante ? (restaurante.id || restaurante) : null
    };
  } catch (err) {
    console.error('Error fetching product:', err);
    return null;
  }
}

/**
 * Obtiene el ID del restaurante desde el slug
 */
export async function getRestaurantId(slug) {
  if (!slug) return null;

  try {
    console.log('🔍 [getRestaurantId] Buscando restaurante con slug:', slug);
    
    // Obtener el objeto completo del restaurante (sin fields para evitar problemas)
    // Usar publicationState=live para asegurar que obtenemos el restaurante publicado
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&publicationState=live`,
      { headers: getAuthHeaders() }
    );

    const allResults = res?.data?.data || [];
    console.log('🔍 [getRestaurantId] Respuesta de API:', {
      totalResults: allResults.length,
      results: allResults.map(r => ({
        id: r.id,
        documentId: r.documentId,
        slug: r?.attributes?.slug || r?.slug,
        name: r?.attributes?.name || r?.name
      }))
    });

    // Buscar todos los restaurantes que coincidan exactamente con el slug
    const matchingRestaurants = allResults.filter(r => {
      const rSlug = r?.attributes?.slug || r?.slug;
      return rSlug === slug;
    });

    if (matchingRestaurants.length === 0) {
      console.warn('⚠️ [getRestaurantId] No se encontró restaurante para slug:', slug);
      console.log('⚠️ [getRestaurantId] Respuesta completa:', res?.data);
      return null;
    }

    // Si hay múltiples restaurantes con el mismo slug, priorizar:
    // 1. El que tenga el ID más bajo (generalmente el más antiguo/principal) - ESTO ES CRÍTICO
    // 2. Entre los publicados, el de ID más bajo
    let data = matchingRestaurants[0];
    
    if (matchingRestaurants.length > 1) {
      console.warn(`⚠️ [getRestaurantId] Se encontraron ${matchingRestaurants.length} restaurantes con el mismo slug:`, slug);
      console.warn(`⚠️ [getRestaurantId] IDs encontrados:`, matchingRestaurants.map(r => ({
        id: r?.id,
        documentId: r?.documentId,
        publishedAt: r?.attributes?.publishedAt || r?.publishedAt
      })));
      
      // SIEMPRE priorizar el de ID más bajo (el más antiguo/principal)
      // Esto es importante porque el endpoint de menús usa el restaurante con ID más bajo
      data = matchingRestaurants.reduce((prev, curr) => {
        const prevId = Number(prev?.id || prev?.documentId || Infinity);
        const currId = Number(curr?.id || curr?.documentId || Infinity);
        if (currId < prevId) {
          return curr;
        }
        return prev;
      });
      
      console.log('✅ [getRestaurantId] Usando restaurante con ID más bajo (principal):', data?.id);
      
      // Verificar que esté publicado (advertencia, pero no bloqueante)
      const attrs = data?.attributes || data;
      if (!attrs?.publishedAt && !data?.publishedAt) {
        console.warn('⚠️ [getRestaurantId] El restaurante seleccionado no está publicado, pero se usará de todas formas');
      }
    }

    // Verificar que el slug coincida exactamente
    const dataSlug = data?.attributes?.slug || data?.slug;
    if (dataSlug !== slug) {
      console.error('❌ [getRestaurantId] El slug del restaurante encontrado no coincide:', {
        esperado: slug,
        obtenido: dataSlug,
        restauranteId: data?.id
      });
      return null;
    }

    console.log('✅ [getRestaurantId] Restaurante encontrado con slug coincidente:', {
      slug: dataSlug,
      id: data?.id,
      documentId: data?.documentId,
      totalMatches: matchingRestaurants.length
    });

    // Preferir id numérico (necesario para filtros API y relación categoría-restaurante)
    let restauranteId =
      (typeof data?.id === 'number' && Number.isFinite(data.id) ? data.id : null) ||
      (data?.attributes && typeof data.attributes.id === 'number' ? data.attributes.id : null) ||
      null;

    // Si la API solo devolvió documentId (Strapi v5), obtener el id numérico con una segunda petición
    if (restauranteId == null && (data?.documentId || data?.attributes?.documentId)) {
      const docId = data?.documentId || data?.attributes?.documentId;
      try {
        const singleRes = await api.get(`/restaurantes/${docId}`, {
          headers: getAuthHeaders()
        });
        const single = singleRes?.data?.data;
        const singleId = single?.id ?? single?.attributes?.id;
        if (typeof singleId === 'number' && Number.isFinite(singleId)) {
          restauranteId = singleId;
          console.log('✅ [getRestaurantId] ID numérico obtenido por documentId:', docId, '->', restauranteId);
        }
      } catch (e) {
        console.warn('⚠️ [getRestaurantId] No se pudo obtener id por documentId:', docId, e?.response?.status);
      }
    }

    // Fallback: string que sea solo dígitos (nunca extraer números de un UUID)
    if (restauranteId == null) {
      const raw = data?.id ?? data?.documentId ?? data?.attributes?.id ?? data?.attributes?.documentId;
      if (typeof raw === 'string' && /^\d+$/.test(raw)) {
        restauranteId = parseInt(raw, 10);
      }
    }

    if (restauranteId != null && (typeof restauranteId !== 'number' || isNaN(restauranteId) || restauranteId <= 0)) {
      console.error('❌ [getRestaurantId] ID inválido después de procesar:', { original: data?.id, processed: restauranteId });
      restauranteId = null;
    }

    console.log('🔍 [getRestaurantId] Restaurante encontrado:', {
      slug,
      restauranteId,
      restauranteIdType: typeof restauranteId,
      originalId: data?.id,
      originalIdType: typeof data?.id,
      documentId: data?.documentId,
      dataKeys: Object.keys(data || {}),
      hasAttributes: !!data?.attributes
    });

    if (!restauranteId) {
      console.error('❌ [getRestaurantId] No se pudo extraer el ID del restaurante:', data);
      return null;
    }

    return restauranteId;
  } catch (err) {
    console.error('❌ [getRestaurantId] Error fetching restaurant ID:', err);
    console.error('❌ [getRestaurantId] Error details:', err?.response?.data || err?.message);
    console.error('❌ [getRestaurantId] Error status:', err?.response?.status);
    return null;
  }
}

/**
 * Crea un producto
 */
export async function createProduct(slug, productData) {
  if (!slug) throw new Error('slug requerido');

  console.log('🔍 [createProduct] Iniciando creación de producto para slug:', slug);
  const restauranteId = await getRestaurantId(slug);
  console.log('🔍 [createProduct] RestauranteId obtenido:', restauranteId, 'Tipo:', typeof restauranteId);
  
  if (!restauranteId) {
    console.error('❌ [createProduct] Restaurante no encontrado para slug:', slug);
    throw new Error('Restaurante no encontrado');
  }

  // Asegurar que restauranteId sea un número
  const restauranteIdNum = Number(restauranteId);
  if (isNaN(restauranteIdNum) || restauranteIdNum <= 0) {
    console.error('❌ [createProduct] ID de restaurante inválido:', restauranteId);
    throw new Error('ID de restaurante inválido');
  }

  try {
    // Convertir descripción de texto plano a formato blocks
    const descriptionBlocks = textToBlocks(productData.description || '');

    const payload = {
      data: {
        name: productData.name,
        price: Number(productData.price),
        description: descriptionBlocks,
        available: productData.available !== false,
        restaurante: restauranteIdNum, // Asegurar que sea un número
        ...(productData.categoriaId && { categoria: productData.categoriaId }),
        ...(productData.imageId && { image: productData.imageId })
      }
    };

    console.log('🔍 [createProduct] Payload a enviar:', JSON.stringify(payload, null, 2));

    const res = await api.post('/productos', payload, { headers: getAuthHeaders() });
    
    console.log('✅ [createProduct] Producto creado exitosamente:', res?.data?.data);
    const createdData = res?.data?.data;
    const catRel = createdData?.categoria ?? createdData?.attributes?.categoria;
    console.log('✅ [createProduct] Campo categoria en respuesta:', catRel ? { id: catRel?.id ?? catRel?.documentId, name: catRel?.name ?? catRel?.attributes?.name } : '(vacío)');
    
    // Verificar que el producto tenga el restaurante asociado
    const createdProduct = res?.data?.data;
    if (createdProduct) {
      const productRestauranteId = createdProduct?.restaurante?.id || 
                                   createdProduct?.restaurante?.data?.id || 
                                   createdProduct?.restaurante ||
                                   createdProduct?.attributes?.restaurante?.data?.id ||
                                   createdProduct?.attributes?.restaurante?.id ||
                                   createdProduct?.attributes?.restaurante;
      
      console.log('🔍 [createProduct] Restaurante asociado al producto:', productRestauranteId);
      
      if (!productRestauranteId || Number(productRestauranteId) !== restauranteIdNum) {
        console.warn('⚠️ [createProduct] El producto fue creado pero el restaurante no está asociado correctamente');
        console.warn('⚠️ [createProduct] Esperado:', restauranteIdNum, 'Obtenido:', productRestauranteId);
      }
    }
    
    return createdProduct || null;
  } catch (err) {
    console.error('❌ [createProduct] Error creating product:', err);
    console.error('❌ [createProduct] Error response:', err?.response?.data);
    console.error('❌ [createProduct] Error status:', err?.response?.status);
    throw err;
  }
}

/**
 * Actualiza un producto
 */
export async function updateProduct(productId, productData) {
  if (!productId) throw new Error('productId requerido');

  try {
    console.log('updateProduct: ID recibido:', productId, 'Tipo:', typeof productId);
    console.log('updateProduct: Datos a actualizar:', productData);

    // Convertir descripción de texto plano a formato blocks si se proporciona
    const descriptionBlocks = productData.description !== undefined
      ? textToBlocks(productData.description || '')
      : undefined;

    // Construir payload de actualización
    const payloadData = {};

    if (productData.name !== undefined) payloadData.name = productData.name;
    if (productData.price !== undefined) payloadData.price = Number(productData.price);
    if (descriptionBlocks !== undefined) payloadData.description = descriptionBlocks;
    if (productData.available !== undefined) payloadData.available = productData.available;

    // Manejar categoriaId: si está definido, incluir en el payload (null para eliminar relación, valor para establecer)
    if (productData.categoriaId !== undefined) {
      payloadData.categoria = productData.categoriaId || null;
    }

    // Manejar imageId: si está definido, incluir en el payload (null para eliminar imagen, valor para establecer)
    if (productData.imageId !== undefined) {
      payloadData.image = productData.imageId || null;
    }

    const payload = { data: payloadData };
    console.log('updateProduct: Payload final:', payload);
    console.log('updateProduct: URL:', `/productos/${productId}`);

    const res = await api.put(`/productos/${productId}`, payload, { headers: getAuthHeaders() });
    console.log('updateProduct: Respuesta exitosa:', res?.data);
    const updatedData = res?.data?.data;
    const catRel = updatedData?.categoria ?? updatedData?.attributes?.categoria;
    console.log('updateProduct: Campo categoria en respuesta:', catRel ? { id: catRel?.id ?? catRel?.documentId, name: catRel?.name ?? catRel?.attributes?.name } : '(vacío)');
    return updatedData || null;
  } catch (err) {
    console.error('Error updating product:', err);
    console.error('Error response:', err?.response?.data);
    console.error('Error status:', err?.response?.status);
    throw err;
  }
}

/**
 * Elimina un producto
 */
export async function deleteProduct(productId) {
  if (!productId) throw new Error('productId requerido');

  try {
    await api.delete(`/productos/${productId}`, { headers: getAuthHeaders() });
    return true;
  } catch (err) {
    console.error('Error deleting product:', err);
    throw err;
  }
}

/**
 * Crea una categoría
 */
export async function createCategory(slug, categoryData) {
  if (!slug) throw new Error('slug requerido');

  console.log('🔍 [createCategory] Obteniendo restauranteId para slug:', slug);
  const restauranteId = await getRestaurantId(slug);
  console.log('🔍 [createCategory] RestauranteId obtenido:', restauranteId);

  if (!restauranteId) {
    console.error('❌ [createCategory] Restaurante no encontrado para slug:', slug);
    throw new Error('Restaurante no encontrado');
  }

  try {
    const payload = {
      data: {
        name: categoryData.name,
        slug: categoryData.slug || categoryData.name.toLowerCase().replace(/\s+/g, '-'),
        restaurante: restauranteId
      }
    };

    console.log('🔍 [createCategory] Enviando payload:', payload);
    const res = await api.post('/categorias', payload, { headers: getAuthHeaders() });
    console.log('✅ [createCategory] Categoría creada exitosamente:', res?.data?.data);
    return res?.data?.data || null;
  } catch (err) {
    console.error('❌ [createCategory] Error creating category:', err);
    console.error('❌ [createCategory] Error response:', err?.response?.data);
    console.error('❌ [createCategory] Error status:', err?.response?.status);
    throw err;
  }
}

/**
 * Actualiza una categoría
 */
export async function updateCategory(categoryId, categoryData) {
  if (!categoryId) throw new Error('categoryId requerido');

  try {
    const payload = {
      data: {
        ...(categoryData.name !== undefined && { name: categoryData.name }),
        ...(categoryData.slug !== undefined && { slug: categoryData.slug })
      }
    };

    const res = await api.put(`/categorias/${categoryId}`, payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error updating category:', err);
    throw err;
  }
}

/**
 * Elimina una categoría
 */
export async function deleteCategory(categoryId) {
  if (!categoryId) throw new Error('categoryId requerido');

  try {
    const url = `/categorias/${categoryId}`;
    console.log('🔍 [deleteCategory] Eliminando categoría', {
      categoryId,
      type: typeof categoryId,
      url,
      baseURL: api.defaults.baseURL
    });

    const response = await api.delete(url, { headers: getAuthHeaders() });
    console.log('✅ [deleteCategory] Categoría eliminada exitosamente', response?.data);
    return true;
  } catch (err) {
    console.error('❌ [deleteCategory] Error deleting category:', err);
    console.error('❌ [deleteCategory] Error response:', err?.response?.data);
    console.error('❌ [deleteCategory] Error status:', err?.response?.status);
    console.error('❌ [deleteCategory] Error config:', {
      url: err?.config?.url,
      method: err?.config?.method,
      headers: err?.config?.headers
    });
    throw err;
  }
}

/**
 * Sube una imagen
 */
export async function uploadImage(file) {
  if (!file) throw new Error('file requerido');

  try {
    const formData = new FormData();
    formData.append('files', file);

    const res = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...getAuthHeaders()
      }
    });

    return res?.data?.[0] || null;
  } catch (err) {
    console.error('Error uploading image:', err);
    throw err;
  }
}


