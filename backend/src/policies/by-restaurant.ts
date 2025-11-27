/**
 * Global policy to scope requests by :slug (restaurant slug).
 * - Ensures the restaurant exists and is published.
 * - Attaches ctx.state.restauranteId and ctx.state.restaurantePlan
 * Usage in routes: config: { policies: ['global::by-restaurant'] }
 */
export default async (policyContext: any, _config: any, { strapi }: any) => {
  console.log('🚀 [by-restaurant] POLICY FUNCIÓN EJECUTADA - INICIO');
  try {
    const ctx = policyContext;
    const slug = ctx.params?.slug;
    
    console.log('🔍 [by-restaurant] Policy ejecutándose:', {
      slug: slug,
      params: ctx.params,
      url: ctx.request?.url,
      method: ctx.request?.method,
      hasStrapi: !!strapi
    });
    
    if (!slug) {
      console.error('❌ [by-restaurant] Missing restaurant slug');
      ctx.unauthorized('Missing restaurant slug');
      return false;
    }

    // Buscar restaurante por slug (con publicationState: 'live')
    // Si no se encuentra publicado, intentar sin publicationState para ver si existe
    let [restaurante] = await strapi.entityService.findMany('api::restaurante.restaurante', {
      filters: { slug },
      fields: ['id', 'slug', 'name', 'Suscripcion', 'publishedAt'],
      publicationState: 'live',
      limit: 1,
    });

    // Si no se encuentra publicado, buscar sin publicationState para debugging
    let restauranteRaw = null;
    if (!restaurante?.id) {
      [restauranteRaw] = await strapi.entityService.findMany('api::restaurante.restaurante', {
        filters: { slug },
        fields: ['id', 'slug', 'name', 'Suscripcion', 'publishedAt'],
        limit: 1,
      });

      if (restauranteRaw?.id) {
        const nameRaw = restauranteRaw?.attributes?.name || restauranteRaw?.name;
        const publishedAt = restauranteRaw?.publishedAt || restauranteRaw?.attributes?.publishedAt;
        
        console.error('❌ [by-restaurant] Restaurante existe pero NO está publicado:', {
          slug,
          restauranteId: restauranteRaw?.id,
          name: nameRaw,
          publishedAt: publishedAt,
          hasPublishedAt: !!publishedAt,
          rawData: JSON.stringify(restauranteRaw, null, 2),
          message: 'El restaurante debe estar publicado (published) para acceder a este endpoint'
        });
        ctx.forbidden('Restaurante no publicado. Debe estar publicado (published) para acceder.');
        return false;
      } else {
        console.error('❌ [by-restaurant] Restaurante no encontrado para slug:', slug);
        ctx.notFound('Restaurante no encontrado');
        return false;
      }
    }

    // Extraer datos correctamente (puede estar en attributes en Strapi v4/v5)
    const restauranteId = restaurante?.id || restaurante?.attributes?.id;
    const name = restaurante?.attributes?.name || restaurante?.name;
    const suscripcion = restaurante?.Suscripcion || restaurante?.attributes?.Suscripcion;

    console.log('✅ [by-restaurant] Restaurante encontrado y publicado:', {
      id: restauranteId,
      slug: restaurante?.slug || restaurante?.attributes?.slug,
      name: name,
      suscripcion: suscripcion
    });

    // Attach to ctx.state so controllers can reuse
    ctx.state.restauranteId = restauranteId;
    // Normalizar Suscripcion a mayúsculas para compatibilidad (basic -> BASIC, pro -> PRO, ultra -> ULTRA)
    const suscripcionNormalizada = suscripcion || 'basic';
    ctx.state.restaurantePlan = suscripcionNormalizada.toUpperCase();
    
    console.log('✅ [by-restaurant] Policy completada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ [by-restaurant] Error en policy:', error);
    return false;
  }
};

