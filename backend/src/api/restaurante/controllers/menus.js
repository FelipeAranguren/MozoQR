// backend/src/api/restaurante/controllers/menus.js
'use strict';

/**
 * GET /restaurants/:slug/menus
 * Returns categories with available products. Hides product image unless plan === 'PRO'.
 */
module.exports = {
  async find(ctx) {
    try {
      console.log('🔍 [menus.find] Iniciando request');
      console.log('🔍 [menus.find] Params:', ctx.params);
      console.log('🔍 [menus.find] State:', ctx.state);
      
      const restauranteId = ctx.state.restauranteId;
      const plan = (ctx.state.restaurantePlan || 'BASIC').toUpperCase();

      if (!restauranteId) {
        console.error('❌ [menus.find] No restauranteId en ctx.state');
        return ctx.badRequest('Restaurante no encontrado');
      }

      console.log('🔍 [menus.find] Restaurante ID:', restauranteId);

      // Obtener información del restaurante (nombre, slug)
      const restaurante = await strapi.entityService.findOne('api::restaurante.restaurante', restauranteId, {
        fields: ['id', 'name', 'slug'],
        publicationState: 'live',
      });

      console.log('🔍 [menus.find] Restaurante encontrado:', restaurante?.name);

      // URL base para imágenes (desde configuración de Strapi)
      const publicUrl = strapi.config.get('server.url', 'http://localhost:1337');
      const buildImageUrl = (relativeUrl) => {
        if (!relativeUrl) return null;
        if (typeof relativeUrl === 'string' && relativeUrl.startsWith('http')) return relativeUrl;
        // Remover leading slash si existe y construir URL absoluta
        const cleanUrl = String(relativeUrl).replace(/^\/+/, '');
        return `${publicUrl}/${cleanUrl}`;
      };

      // Categorías del restaurante + productos disponibles
      console.log('🔍 [menus.find] Buscando categorías para restaurante:', restauranteId);
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

      console.log('🔍 [menus.find] Categorías encontradas:', categorias?.length || 0);

    // Sanitizar: ocultar imagen si plan !== PRO
    const sanitized = (categorias || []).map((cat) => {
      const c = cat.attributes || cat;
      const productos = (c.productos?.data || c.productos || []).map((p) => {
        const a = p.attributes || p;
        const out = {
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

      console.log('🔍 [menus.find] Categorías sanitizadas:', sanitized?.length || 0);

      const response = {
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

      console.log('✅ [menus.find] Enviando respuesta:', JSON.stringify(response, null, 2).substring(0, 500));
      ctx.body = response;
    } catch (error) {
      console.error('❌ [menus.find] Error:', error);
      console.error('❌ [menus.find] Stack:', error.stack);
      ctx.throw(500, 'Error obteniendo menú');
    }
  },
};