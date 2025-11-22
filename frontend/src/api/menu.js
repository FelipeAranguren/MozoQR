// frontend/src/api/menu.js
import { api } from '../api';

// Helper para obtener token de autenticación
function getAuthHeaders() {
  const token = localStorage.getItem('strapi_jwt') || localStorage.getItem('jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Obtiene todas las categorías de un restaurante
 */
export async function fetchCategories(slug) {
  if (!slug) return [];

  try {
    // Primero obtener el ID del restaurante
    const restauranteId = await getRestaurantId(slug);
    if (!restauranteId) {
      console.warn('No se encontró el restaurante con slug:', slug);
      return [];
    }

    const res = await api.get(
      `/categorias?filters[restaurante][id][$eq]=${restauranteId}&populate[productos][populate]=image&sort[0]=name:asc&publicationState=preview`,
      { headers: getAuthHeaders() }
    );
    
    const data = res?.data?.data || [];
    return data.map(item => {
      const attr = item.attributes || item;
      return {
        id: item.id || item.documentId,
        documentId: item.documentId,
        name: attr.name || '',
        slug: attr.slug || '',
        productos: attr.productos?.data || attr.productos || []
      };
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    console.error('Error details:', err?.response?.data || err?.message);
    return [];
  }
}

/**
 * Obtiene todos los productos de un restaurante
 */
export async function fetchProducts(slug, categoryId = null) {
  if (!slug) return [];

  try {
    // Estrategia 1: Obtener productos desde las categorías (más confiable)
    console.log('Estrategia 1: Obteniendo productos desde categorías...');
    const categories = await fetchCategories(slug);
    
    // Extraer todos los productos de todas las categorías
    const allProducts = [];
    categories.forEach(cat => {
      const productos = cat.productos || [];
      console.log(`Categoría "${cat.name}" tiene ${productos.length} productos`);
      productos.forEach(prod => {
        // Normalizar la estructura del producto
        // Los productos desde categorías pueden venir con o sin attributes
        const prodAttr = prod.attributes || prod;
        const prodId = prod.id || prod.documentId || prodAttr.id || prodAttr.documentId;
        
        console.log('Producto desde categoría:', {
          raw: prod,
          prodId,
          name: prodAttr.name,
          hasAttributes: !!prod.attributes
        });
        
        // Agregar el categoriaId y categoriaName al producto y asegurar que tenga id
        const p = { 
          ...prod,
          id: prodId,
          documentId: prod.documentId || prodAttr.documentId,
          attributes: prodAttr,
          categoriaId: cat.id,
          categoriaName: cat.name // Agregar el nombre de la categoría
        };
        allProducts.push(p);
      });
    });
    
    console.log('Productos encontrados desde categorías:', allProducts.length);
    console.log('Ejemplo de producto:', allProducts[0]);
    
    if (allProducts.length > 0) {
      let filtered = allProducts;
      if (categoryId) {
        filtered = allProducts.filter(p => {
          const pCatId = String(p.categoriaId || '');
          const selectedCatId = String(categoryId || '');
          return pCatId === selectedCatId;
        });
      }
      
      return mapProducts(filtered);
    }

    // Estrategia 2: Filtrar productos por ID del restaurante
    console.log('Estrategia 2: Filtrando productos por ID del restaurante...');
    const restauranteId = await getRestaurantId(slug);
    if (!restauranteId) {
      console.warn('No se encontró el restaurante con slug:', slug);
      return [];
    }

    let url = `/productos?filters[restaurante][id][$eq]=${restauranteId}&populate[image,categoria]&sort[0]=name:asc&publicationState=preview`;
    if (categoryId) {
      url += `&filters[categoria][id][$eq]=${categoryId}`;
    }
    
    console.log('Fetching products from URL:', url);
    const res = await api.get(url, { headers: getAuthHeaders() });
    
    console.log('Raw API response:', res?.data);
    const data = res?.data?.data || [];
    console.log('Products data array:', data.length);
    
    if (data.length > 0) {
      return mapProducts(data);
    }

    // Estrategia 3: Intentar con slug directamente
    console.log('Estrategia 3: Intentando con slug directamente...');
    let urlSlug = `/productos?filters[restaurante][slug][$eq]=${slug}&populate[image,categoria]&sort[0]=name:asc&publicationState=preview`;
    if (categoryId) {
      urlSlug += `&filters[categoria][id][$eq]=${categoryId}`;
    }
    const resSlug = await api.get(urlSlug, { headers: getAuthHeaders() });
    const dataSlug = resSlug?.data?.data || [];
    console.log('Products with slug filter:', dataSlug.length);
    
    return mapProducts(dataSlug);
  } catch (err) {
    console.error('Error fetching products:', err);
    console.error('Error details:', err?.response?.data || err?.message);
    console.error('Error status:', err?.response?.status);
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
  const baseURL = import.meta.env?.VITE_API_URL?.replace('/api', '') || '';
  
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
    const res = await api.get(
      `/restaurantes?filters[slug][$eq]=${slug}&fields[0]=id`,
      { headers: getAuthHeaders() }
    );
    
    const data = res?.data?.data?.[0];
    const restauranteId = data?.id || data?.documentId || null;
    console.log('Restaurante ID obtenido:', restauranteId, 'para slug:', slug);
    return restauranteId;
  } catch (err) {
    console.error('Error fetching restaurant ID:', err);
    console.error('Error details:', err?.response?.data || err?.message);
    return null;
  }
}

/**
 * Crea un producto
 */
export async function createProduct(slug, productData) {
  if (!slug) throw new Error('slug requerido');

  const restauranteId = await getRestaurantId(slug);
  if (!restauranteId) throw new Error('Restaurante no encontrado');

  try {
    // Convertir descripción de texto plano a formato blocks
    const descriptionBlocks = textToBlocks(productData.description || '');
    
    const payload = {
      data: {
        name: productData.name,
        price: Number(productData.price),
        description: descriptionBlocks,
        available: productData.available !== false,
        restaurante: restauranteId,
        ...(productData.categoriaId && { categoria: productData.categoriaId }),
        ...(productData.imageId && { image: productData.imageId })
      }
    };

    const res = await api.post('/productos', payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error creating product:', err);
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
    return res?.data?.data || null;
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

  const restauranteId = await getRestaurantId(slug);
  if (!restauranteId) throw new Error('Restaurante no encontrado');

  try {
    const payload = {
      data: {
        name: categoryData.name,
        slug: categoryData.slug || categoryData.name.toLowerCase().replace(/\s+/g, '-'),
        restaurante: restauranteId
      }
    };

    const res = await api.post('/categorias', payload, { headers: getAuthHeaders() });
    return res?.data?.data || null;
  } catch (err) {
    console.error('Error creating category:', err);
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
    await api.delete(`/categorias/${categoryId}`, { headers: getAuthHeaders() });
    return true;
  } catch (err) {
    console.error('Error deleting category:', err);
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

