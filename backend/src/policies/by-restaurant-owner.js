// backend/src/policies/by-restaurant-owner.js
'use strict';

module.exports = {
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

    // ⚠️ Ajustá 'Slug' -> 'slug' si tu campo es minúscula
    const restaurant = await strapi.db
      .query('api::restaurante.restaurante')
      .findFirst({
        where: { slug },
       select: ['id', 'slug'],

      });

    if (!restaurant) {
      ctx.notFound('Restaurant not found');
      return false;
    }

    const membership = await strapi.db
      .query('api::restaurant-member.restaurant-member')
      .findFirst({
        where: {
          restaurante: restaurant.id,
          users_permissions_user: user.id,
          active: true,
          role: 'owner', // usa { $in: ['owner','manager'] } si querés permitir managers
        },
        select: ['id'],
      });

    if (!membership) {
      ctx.forbidden('You do not have owner access to this restaurant');
      return false;
    }

    ctx.state.restauranteId = restaurant.id;
    return true;
  },
};
