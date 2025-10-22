// backend/src/api/restaurante/controllers/owner.ts
import type { Context } from 'koa';

export default {
  async ownerAuthzCheck(ctx: Context) {
    ctx.body = {
      ok: true,
      slug: ctx.params.slug,
      restauranteId: ctx.state.restauranteId ?? null,
      userId: ctx.state.user?.id ?? null,
    };
  },
};
