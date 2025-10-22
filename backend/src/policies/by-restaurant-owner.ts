// backend/src/policies/by-restaurant-owner.ts
export default {
  name: 'by-restaurant-owner',

  async policy(ctx, _config, { strapi }) {
    const user = ctx.state.user;
    if (!user) {
      ctx.unauthorized('Authentication required');
      return false;
    }

    const slug = ctx.params?.slug;
    if (!slug) {
      ctx.badRequest('Missing restaurant slug');
      return false;
    }

    // 1) validar que exista algún restaurante con ese slug (opcional, pero útil)
    const [restaurant] = await strapi.db
      .query('api::restaurante.restaurante')
      .findMany({
        where: { slug },
        select: ['id', 'slug'],
        limit: 1,
      });

    if (!restaurant) {
      ctx.notFound('Restaurant not found');
      return false;
    }

    // 2) chequear membership por SLUG + USER (soporta slugs duplicados)
    const [membership] = await strapi.db
      .query('api::restaurant-member.restaurant-member')
      .findMany({
        where: {
          restaurante: { slug },                 // 👈 clave
          users_permissions_user: { id: user.id },
          role: 'owner',
          active: true,
        },
        populate: { restaurante: { select: ['id', 'slug'] } },
        select: ['id'],
        limit: 1,
      });

    if (!membership) {
      ctx.forbidden('You do not have owner access to this restaurant');
      return false;
    }

    // Usamos el restaurante real de la membership (por si hay duplicados)
    ctx.state.restauranteId = membership.restaurante.id;
    return true;
  },
};
