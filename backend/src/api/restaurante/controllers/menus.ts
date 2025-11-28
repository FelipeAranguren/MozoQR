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
    name: string;
    slug: string | null;
    productos: Product[];
}

export default {
    /**
     * GET /restaurants/:slug/menus
     * Returns categories with available products. Hides product image unless plan === 'PRO'.
     */
    async find(ctx: any) {
        console.log('🚀 [menus.find] Controller START');
        try {
            let restauranteId = ctx.state.restauranteId;
            let plan = (ctx.state.restaurantePlan || 'BASIC').toUpperCase();

            console.log('🔍 [menus.find] Context State:', {
                restauranteId,
                plan,
                params: ctx.params
            });

            if (!restauranteId) {
                console.warn('⚠️ [menus.find] Missing restauranteId in state - Attempting fallback lookup');
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
                    // Normalizar plan
                    const rawPlan = restauranteFallback.Suscripcion || restauranteFallback.attributes?.Suscripcion || 'basic';
                    plan = rawPlan.toUpperCase();
                    console.log('✅ [menus.find] Fallback successful:', { restauranteId, plan });
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

            // Categorías del restaurante + productos disponibles
            const categorias = await strapi.entityService.findMany('api::categoria.categoria', {
                filters: { restaurante: restauranteId },
                sort: { name: 'asc' },
                fields: ['id', 'name', 'Slug'],
                populate: {
                    productos: {
                        filters: { available: true },
                        sort: { name: 'asc' },
                        fields: ['id', 'name', 'price', 'available', 'sku', 'slug', 'description'],
                        populate: { image: true },
                    },
                },
                publicationState: 'live',
                limit: 200,
            });

            // Sanitizar: ocultar imagen si plan !== PRO
            const sanitized: Category[] = (categorias || []).map((cat: any) => {
                const c = cat.attributes || cat;
                const productos = (c.productos?.data || c.productos || []).map((p: any) => {
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
                    if (String(plan) === 'PRO') {
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
                });
                return {
                    id: cat.id || c.id,
                    name: c.name,
                    slug: c.Slug || c.slug || null,
                    productos,
                };
            });

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
