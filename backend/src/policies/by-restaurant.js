// backend/src/policies/by-restaurant.js
'use strict';

/**
 * Global policy to scope requests by :slug (restaurant slug).
 * - Ensures the restaurant exists and is published.
 * - Attaches ctx.state.restauranteId and ctx.state.restaurantePlan
 * Usage in routes: config: { policies: ['global::by-restaurant'] }
 */
module.exports = async (policyContext, config, { strapi }) => {
  const ctx = policyContext;
  const slug = ctx.params?.slug;
  if (!slug) {
    ctx.unauthorized('Missing restaurant slug');
    return false;
  }

  const [restaurante] = await strapi.entityService.findMany('api::restaurante.restaurante', {
    filters: { slug },
    fields: ['id', 'slug', 'plan'],
    publicationState: 'live',
    limit: 1,
  });

  if (!restaurante?.id) {
    ctx.notFound('Restaurante no encontrado');
    return false;
  }

  // Attach to ctx.state so controllers can reuse
  ctx.state.restauranteId = restaurante.id;
  ctx.state.restaurantePlan = restaurante.plan || 'BASIC';
  return true;
};
