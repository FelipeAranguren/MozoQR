/**
 * menus controller
 */

import { getBackendUrl } from '../../../config/urls';

declare const strapi: any;

interface Product {
    id: number;
    name: string;
    price: number;
    available: boolean;
    sku: string | null;
    slug: string | null;
    description: string | null;
    image?: string | null;
}

interface Category {
    id: number;
    documentId?: string | null;
    name: string;
    slug: string | null;
    productos: Product[];
}

export default {
    /**
     * GET /restaurants/:slug/menus
     * Returns categories with only available products (available === true).
     * Hides product image unless plan === 'PRO'.
     */
    async find(ctx: any) {
        try {
            let restauranteId = ctx.state.restauranteId;
            let plan = (ctx.state.restaurantePlan || 'BASIC').toUpperCase();

            if (!restauranteId) {
                const slug = ctx.params.slug;
                if (!slug) {
                    return ctx.badRequest('Missing slug');
                }

                const [restauranteFallback] = await strapi.entityService.findMany('api::restaurante.restaurante', {
                    filters: { slug },
                    fields: ['id', 'name', 'slug', 'Suscripcion'],
                    publicationState: 'live',
                    limit: 1,
                });

                if (restauranteFallback) {
                    restauranteId = restauranteFallback.id;
                    const rawPlan = restauranteFallback.Suscripcion || restauranteFallback.attributes?.Suscripcion || 'basic';
                    plan = rawPlan.toUpperCase();
                } else {
                    console.error('❌ [menus.find] Restaurante not found via fallback slug:', slug);
                    return ctx.notFound('Restaurante not found');
                }
            }

            // Obtener información del restaurante (nombre, slug)
            // Si ya lo tenemos del fallback, lo reusamos o lo buscamos de nuevo (entityService.findOne es rápido)
            const restaurante = await strapi.entityService.findOne('api::restaurante.restaurante', restauranteId, {
                fields: ['id', 'name', 'slug'],
                publicationState: 'live',
            });

            if (!restaurante) {
                console.error('❌ [menus.find] Restaurante not found via entityService');
                return ctx.notFound('Restaurante not found');
            }

            // URL base para imágenes (desde configuración centralizada)
            const publicUrl = getBackendUrl(strapi.config);
            const buildImageUrl = (relativeUrl: string | null) => {
                if (!relativeUrl) return null;
                if (typeof relativeUrl === 'string' && relativeUrl.startsWith('http')) return relativeUrl;
                // Remover leading slash si existe y construir URL absoluta
                const cleanUrl = String(relativeUrl).replace(/^\/+/, '');
                return `${publicUrl}/${cleanUrl}`;
            };

            // Helper para mapear productos
            const mapProduct = (p: any, planLevel: string): Product => {
                const a = p.attributes || p;
                const out: Product = {
                    id: p.id || a.id,
                    name: a.name,
                    price: Number(a.price || 0),
                    available: !!a.available,
                    sku: a.sku || null,
                    slug: a.slug || null,
                    description: a.description || null,
                };
                // Incluir imágenes para planes PRO y ULTRA
                if (String(planLevel) === 'PRO' || String(planLevel) === 'ULTRA') {
                    // include absolute media URL if present
                    const img = a.image?.data || a.image;
                    if (img) {
                        const url = img.attributes?.url || img.url;
                        out.image = buildImageUrl(url);
                    } else {
                        out.image = null;
                    }
                } else {
                    out.image = null;
                }
                return out;
            };

            // Categorías del restaurante + productos disponibles
            // Primero intentar con 'live', luego con 'preview' para incluir borradores
            // Usar formato { id: restauranteId } para evitar problemas con restaurantes no publicados
            let categorias = await strapi.entityService.findMany('api::categoria.categoria', {
                filters: { restaurante: { id: restauranteId } },
                sort: { name: 'asc' },
                fields: ['id', 'name', 'slug'],
                populate: {
                    productos: {
                        // Filtrar solo productos disponibles (available === true)
                        filters: { available: { $eq: true } },
                        sort: { name: 'asc' },
                        fields: ['id', 'name', 'price', 'available', 'sku', 'slug', 'description'],
                        populate: { image: true },
                    },
                },
                publicationState: 'live',
                limit: 200,
            });

            // Si no hay categorías publicadas, intentar con preview para incluir borradores
            if ((categorias?.length || 0) === 0) {
                const categoriasPreview = await strapi.entityService.findMany('api::categoria.categoria', {
                    filters: { restaurante: { id: restauranteId } },
                    sort: { name: 'asc' },
                    fields: ['id', 'name', 'slug'],
                    populate: {
                        productos: {
                            // Filtrar solo productos disponibles (available === true)
                            filters: { available: { $eq: true } },
                            sort: { name: 'asc' },
                            fields: ['id', 'name', 'price', 'available', 'sku', 'slug', 'description'],
                            populate: { image: true },
                        },
                    },
                    publicationState: 'preview',
                    limit: 200,
                });
                if (categoriasPreview && categoriasPreview.length > 0) {
                    categorias = categoriasPreview;
                }
            }

            // También obtener TODOS los productos disponibles del restaurante directamente (sin filtro de categoría)
            // para asegurarnos de que no se pierda ninguno
            // Usar formato { id: restauranteId } para evitar problemas con restaurantes no publicados
            const todosLosProductos = await strapi.entityService.findMany('api::producto.producto', {
                filters: {
                    restaurante: { id: restauranteId },
                    available: { $eq: true }, // Solo productos disponibles
                },
                sort: { name: 'asc' },
                fields: ['id', 'name', 'price', 'available', 'sku', 'slug', 'description'],
                populate: { 
                    image: true,
                    categoria: {
                        fields: ['id', 'name', 'slug'],
                    },
                },
                publicationState: 'live',
                limit: 500, // Aumentar límite para obtener todos
            });

            // También obtener productos disponibles en preview para incluir borradores
            // Usar formato { id: restauranteId } para evitar problemas con restaurantes no publicados
            const productosPreview = await strapi.entityService.findMany('api::producto.producto', {
                filters: {
                    restaurante: { id: restauranteId },
                    available: { $eq: true }, // Solo productos disponibles
                },
                sort: { name: 'asc' },
                fields: ['id', 'name', 'price', 'available', 'sku', 'slug', 'description'],
                populate: { 
                    image: true,
                    categoria: {
                        fields: ['id', 'name', 'slug'],
                    },
                },
                publicationState: 'preview',
                limit: 500,
            });

            // Combinar productos publicados y en preview, eliminando duplicados por ID
            const productosMap = new Map<number, any>();
            
            // Primero agregar los publicados
            (todosLosProductos || []).forEach((p: any) => {
                const id = p.id || p.attributes?.id;
                if (id) productosMap.set(id, p);
            });
            
            // Luego agregar los de preview (sobrescribirán los publicados si hay duplicados, pero eso está bien)
            (productosPreview || []).forEach((p: any) => {
                const id = p.id || p.attributes?.id;
                if (id) productosMap.set(id, p);
            });

            const productosTotales = Array.from(productosMap.values());

            // Reconstruir categorías desde todos los productos para asegurar que no se pierda ninguno
            // Usar SIEMPRE id numérico como clave para que product.categoria.id (numérico) coincida
            const categoriasMap = new Map<number, Category>();
            const productosSinCategoria: any[] = [];

            const toNumId = (id: any): number | null => {
                if (id == null) return null;
                if (typeof id === 'number' && Number.isFinite(id)) return id;
                if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10);
                return null;
            };

            // Strapi 5 puede devolver relación categoria por documentId (string UUID). Mapa documentId -> id numérico.
            const documentIdToNumId = new Map<string, number>();

            // Primero, agregar categorías existentes al mapa (clave = id numérico)
            (categorias || []).forEach((cat: any) => {
                const c = cat.attributes || cat;
                const numId = toNumId(cat.id ?? c.id);
                if (numId == null) return;
                const docId = cat.documentId ?? c.documentId ?? null;
                if (docId && typeof docId === 'string') {
                    documentIdToNumId.set(docId, numId);
                }
                categoriasMap.set(numId, {
                    id: numId,
                    documentId: docId && typeof docId === 'string' ? docId : null,
                    name: c.name ?? cat.name,
                    slug: c.slug ?? cat.slug ?? null,
                    productos: [],
                });
            });

            const resolveCategoriaId = (raw: any): number | null => {
                const num = toNumId(raw);
                if (num != null) return num;
                if (raw != null && typeof raw === 'string' && documentIdToNumId.has(raw)) {
                    return documentIdToNumId.get(raw)!;
                }
                return null;
            };

            // Procesar todos los productos disponibles y asignarlos a sus categorías
            productosTotales.forEach((p: any) => {
                const a = p.attributes || p;
                const isAvailable = a.available !== false;
                if (!isAvailable) return;

                const catRel = a.categoria?.data ?? a.categoria;
                const rawCategoriaId = catRel?.id ?? catRel?.documentId ?? null;
                const categoriaId = resolveCategoriaId(rawCategoriaId);
                const categoriaData = a.categoria?.data?.attributes ?? a.categoria?.attributes ?? a.categoria;

                if (categoriaId != null && categoriasMap.has(categoriaId)) {
                    const categoria = categoriasMap.get(categoriaId)!;
                    categoria.productos.push(mapProduct(p, plan));
                } else if (categoriaId != null && categoriaData) {
                    const docIdCat = catRel?.documentId ?? categoriaData.documentId ?? null;
                    categoriasMap.set(categoriaId, {
                        id: categoriaId,
                        documentId: typeof docIdCat === 'string' ? docIdCat : null,
                        name: categoriaData.name ?? null,
                        slug: categoriaData.slug ?? null,
                        productos: [mapProduct(p, plan)],
                    });
                } else {
                    productosSinCategoria.push(p);
                }
            });

            // Convertir mapa a array y ordenar
            const sanitized: Category[] = Array.from(categoriasMap.values())
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cat => {
                    cat.productos.sort((a, b) => a.name.localeCompare(b.name));
                    return cat;
                });
            
            // Si hay productos sin categoría, crear una categoría "Otros" o agregarlos a una existente
            if (productosSinCategoria && productosSinCategoria.length > 0) {
                // Filtrar solo productos disponibles antes de mapear (doble verificación)
                const productosDisponibles = productosSinCategoria.filter((p: any) => {
                    const a = p.attributes || p;
                    return a.available !== false;
                });
                
                const productosMapeados = productosDisponibles.map((p: any) => mapProduct(p, plan));
                
                // Buscar si ya existe una categoría "Otros"
                let otrosIndex = sanitized.findIndex(cat => 
                    cat.name?.toLowerCase() === 'otros' || cat.name?.toLowerCase() === 'sin categoría'
                );
                
                if (otrosIndex >= 0) {
                    sanitized[otrosIndex].productos = [
                        ...sanitized[otrosIndex].productos,
                        ...productosMapeados
                    ];
                    // Reordenar productos dentro de la categoría
                    sanitized[otrosIndex].productos.sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    if (productosMapeados.length > 0) {
                        sanitized.push({
                            id: -1, // ID temporal para productos sin categoría
                            documentId: null,
                            name: 'Otros',
                            slug: 'otros',
                            productos: productosMapeados,
                        });
                    }
                }
            }

            // Filtrar categorías vacías (opcional - comentado para debug)
            // const categoriasConProductos = sanitized.filter(cat => cat.productos.length > 0);
            // console.log(`✅ [menus.find] Final: ${categoriasConProductos.length} categories with products`);

            const totalProductos = sanitized.reduce((sum, cat) => sum + cat.productos.length, 0);

            ctx.body = {
                data: {
                    restaurant: {
                        id: restaurante?.id || restauranteId,
                        name: restaurante?.name || null,
                        slug: restaurante?.slug || ctx.params?.slug || null,
                        plan: plan,
                    },
                    categories: sanitized,
                },
            };
        } catch (error: any) {
            console.error('❌ [menus.find] Error:', error);
            return ctx.badRequest('Error processing request', { error: error.message });
        }
    },
};
