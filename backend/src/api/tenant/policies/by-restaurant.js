'use strict';

/**
 * Policy local del API tenant para scoping por :slug (restaurant slug).
 * Uso en rutas: config: { policies: ['api::tenant.by-restaurant'] }
 */
module.exports = async (policyContext, config, { strapi }) => {
  const ctx = policyContext;
  const rawSlug = ctx.params?.slug;

  if (!rawSlug) {
    ctx.unauthorized('Missing restaurant slug');
    return false;
  }

  const slug = String(rawSlug).trim().toLowerCase();

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

  // Dejo ambos nombres por compatibilidad con distintos handlers
  ctx.state.restauranteId   = restaurante.id;
  ctx.state.restaurantId    = restaurante.id;
  ctx.state.restaurantePlan = restaurante.plan || 'BASIC';

  return true;
};
