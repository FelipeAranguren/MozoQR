//backend/src/api/restaurante/controllers/owner.js
'use strict';
module.exports = {
  async ownerAuthzCheck(ctx) {
    ctx.body = {
      ok: true,
      slug: ctx.params.slug,
      restauranteId: ctx.state.restauranteId ?? null,
      userId: ctx.state.user?.id ?? null,
    };
  },
};