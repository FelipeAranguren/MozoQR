// backend/src/api/restaurante/controllers/menus.js
'use strict';

/**
 * GET /restaurants/:slug/menus
 * Returns categories with available products. Hides product image unless plan === 'PRO'.
 */
module.exports = {
  async find(ctx) {
    const restauranteId = ctx.state.restauranteId;
    const plan = (ctx.state.restaurantePlan || 'BASIC').toUpperCase();

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
            out.image = url || null;
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

    ctx.body = { data: { categories: sanitized } };
  },
};
