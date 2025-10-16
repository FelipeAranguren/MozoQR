'use strict';

module.exports = {
  async ping(ctx) {
    ctx.body = { ok: true, where: 'restaurante/membership routes loaded' };
  },

  async me(ctx) {
    const { slug } = ctx.params;
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    // Content-type de la membresía
    const UID = 'api::restaurant-member.restaurant-member';

    const rows = await strapi.entityService.findMany(UID, {
      filters: {
        restaurante: { slug },
        users_permissions_user: { id: userId },
      },
      populate: { restaurante: true },
      limit: 1,
    });

    const member = rows?.[0];
    if (!member) return ctx.forbidden();

    ctx.body = { data: { role: member.role, restaurante: member.restaurante } };
  },
};
