/**
 * menus controller
 */

import { getBackendUrl } from '../../../config/urls';

declare const strapi: any;

export default {
    /**
     * GET /restaurants/:slug/menus
     * Returns categories with available products. Hides product image unless plan === 'PRO'.
     */
    async find(ctx: any) {
        const restauranteId = ctx.state.restauranteId;
        const plan = (ctx.state.restaurantePlan || 'BASIC').toUpperCase();

        // Obtener información del restaurante (nombre, slug)
        const restaurante = await strapi.entityService.findOne('api::restaurante.restaurante', restauranteId, {
            fields: ['id', 'name', 'slug'],
            publicationState: 'live',
        });

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
        const sanitized = (categorias || []).map((cat: any) => {
            const c = cat.attributes || cat;
            const productos = (c.productos?.data || c.productos || []).map((p: any) => {
                const a = p.attributes || p;
                const out: any = {
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
    },
};
