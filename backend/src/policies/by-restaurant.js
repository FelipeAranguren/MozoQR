'use strict';

/**
 * backend/src/policies/by-restaurant.js
 *
 * Política multitenant (Strapi v4) que:
 *  - Resuelve restaurante por :slug y lo expone en ctx.state.restauranteId
 *  - En POST/PUT/PATCH fuerza data.restaurante = restauranteId
 *  - En GET inyecta filtros para scoped reads (merge con filtros existentes)
 *  - Exige membresía (owner|staff) para cualquier ruta NO pública
 *
 * Rutas públicas por diseño (no requieren membresía):
 *  - GET  */menus
 //*  - POST */orders
 //*  - POST */payments
 //*
 //* Todo lo demás: requiere login (JWT Users & Permissions) y ser miembro del restaurante.
 //*/

const UPPER = (s) => String(s || '').toUpperCase();
const isWrite = (m) => ['POST', 'PUT', 'PATCH'].includes(UPPER(m));
const isRead = (m) => UPPER(m) === 'GET';

const isPublicPath = (path, method) => {
  const p = String(path || '').toLowerCase();
  const m = UPPER(method);

  // Menú (público, lectura)
  if (m === 'GET' && /\/menus(\/|$)/.test(p)) return true;
  // Crear pedido (público, escritura)
  if (m === 'POST' && /\/orders(\/|$)/.test(p)) return true;
  // Pagos (intención/webhook) – ajustar si tenés rutas separadas
  if (m === 'POST' && /\/payments(\/|$)/.test(p)) return true;

  return false;
};

const isMembershipPath = (path, method) => {
  const p = String(path || '').toLowerCase();
  const m = UPPER(method);
  return m === 'GET' && /\/membership(\/|$)/.test(p);
};


// Combina filtros existentes con el filtro de restaurante usando $and
function mergeTenantFilter(existingFilters, restauranteId) {
  const tenant = { restaurante: { id: restauranteId } };
  if (!existingFilters || typeof existingFilters !== 'object' || Object.keys(existingFilters).length === 0) {
    return tenant;
  }
  // Si ya hay $and/$or, intentamos andear sin romper
  if (Object.prototype.hasOwnProperty.call(existingFilters, '$and')) {
    const andArr = Array.isArray(existingFilters.$and) ? existingFilters.$and : [existingFilters.$and];
    return { $and: [...andArr, tenant] };
  }
  // Si ya hay un filtro plano, creamos un $and con ambos
  return { $and: [existingFilters, tenant] };
}

module.exports = async (ctx, _config, { strapi }) => {
  try {
    // 1) Resolver slug desde params/body/query
    // aceptar alias comunes de slug en params
// 1) Resolver slug desde params/body/query
    // aceptar alias comunes de slug en params
    const paramSlug =
      ctx.params?.slug ??
      ctx.params?.restaurantSlug ??
      ctx.params?.restauranteSlug ??
      null;

    const slug =
      paramSlug ||
      ctx.request?.body?.slug ||
      ctx.request?.body?.data?.slug ||
      ctx.query?.slug;

    if (!slug) {
      ctx.badRequest('Falta :slug del restaurante');
      return false;
    }

    // 2) Buscar restaurante por slug
    const [restaurant] = await strapi.entityService.findMany('api::restaurante.restaurante', {
      filters: { slug },
      fields: ['id', 'slug'],
      limit: 1,
      publicationState: 'live',
    });
    if (!restaurant) {
      ctx.notFound('Restaurante no existe');
      return false;
    }

    // 3) Exponer tenant en el contexto
    ctx.state.restaurant = restaurant;
    ctx.state.restauranteId = restaurant.id;

    // 4) Forzar scope en escrituras
    if (isWrite(ctx.request.method)) {
      ctx.request.body = ctx.request.body || {};
      if (!ctx.request.body.data || typeof ctx.request.body.data !== 'object') {
        ctx.request.body.data = {};
      }
      // Ignorar cualquier restaurante enviado por el cliente y fijar el correcto
      ctx.request.body.data.restaurante = restaurant.id;
    }

    // 5) Forzar scope en lecturas (merge de filtros)
    if (isRead(ctx.request.method)) {
      ctx.query = ctx.query || {};
      ctx.query.filters = mergeTenantFilter(ctx.query.filters, restaurant.id);
    }

    // 6) Exigir membresía en TODAS las rutas no públicas
    if (!isPublicPath(ctx.request.path, ctx.request.method)) {
      const user = ctx.state.user; // JWT (Users & Permissions)
      if (!user) {
        ctx.unauthorized('Login requerido');
        return false;
      }

      const member = await strapi.db
        .query('api::restaurant-member.restaurant-member')
        .findOne({
          where: { user: user.id, restaurante: restaurant.id },
          select: ['id', 'role'],
        });

      if (!member) {
        ctx.forbidden('No tenés acceso a este restaurante');
        return false;
      }

      // Exponer rol por si algún controller lo necesita
      ctx.state.restaurantMemberRole = member.role;
    }

    return true;
  } catch (err) {
    strapi.log.error('[policy by-restaurant] Error:', err);
    ctx.internalServerError('Error en política multitenant');
    return false;
  }
};
