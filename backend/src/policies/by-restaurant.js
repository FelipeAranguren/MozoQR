// backend/src/policies/by-restaurant.js
'use strict';

/**
 * Global policy to scope requests by :slug (restaurant slug).
 * - Ensures the restaurant exists and is published.
 * - Attaches ctx.state.restauranteId and ctx.state.restaurantePlan
 * Usage in routes: config: { policies: ['global::by-restaurant'] }
 */
module.exports = async (policyContext, config, { strapi }) => {
  try {
    const ctx = policyContext;
    const slug = ctx.params?.slug;
    
    console.log('🔍 [by-restaurant] Policy ejecutándose para slug:', slug);
    
    if (!slug) {
      console.error('❌ [by-restaurant] Missing restaurant slug');
      ctx.unauthorized('Missing restaurant slug');
      return false;
    }

    const [restaurante] = await strapi.entityService.findMany('api::restaurante.restaurante', {
      filters: { slug },
      fields: ['id', 'slug', 'Suscripcion'],
      publicationState: 'live',
      limit: 1,
    });

    console.log('🔍 [by-restaurant] Restaurante encontrado:', restaurante?.id, restaurante?.name);

    if (!restaurante?.id) {
      console.error('❌ [by-restaurant] Restaurante no encontrado para slug:', slug);
      ctx.notFound('Restaurante no encontrado');
      return false;
    }

    // Attach to ctx.state so controllers can reuse
    ctx.state.restauranteId = restaurante.id;
    // Normalizar Suscripcion a mayúsculas para compatibilidad (basic -> BASIC, pro -> PRO, ultra -> ULTRA)
    const suscripcion = restaurante.Suscripcion || restaurante.suscripcion || 'basic';
    ctx.state.restaurantePlan = suscripcion.toUpperCase();
    
    console.log('✅ [by-restaurant] Policy completada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ [by-restaurant] Error en policy:', error);
    return false;
  }
};