import {
  adjustAccountPoints,
  creditLoyaltyForPaidOrder,
  getOrCreateAccount,
  getOrCreateProgram,
  getRestaurantBySlug,
  redeemPoints,
} from '../../../services/loyalty-core';

declare const strapi: any;

const PROGRAM_UID = 'api::loyalty-program.loyalty-program';
const ACCOUNT_UID = 'api::loyalty-account.loyalty-account';
const TX_UID = 'api::loyalty-transaction.loyalty-transaction';
const USER_UID = 'plugin::users-permissions.user';

export { creditLoyaltyForPaidOrder };

export default {
  /** GET /restaurants/:slug/loyalty/program — público */
  async publicProgram(ctx: any) {
    const restaurant = await getRestaurantBySlug(strapi, ctx.params.slug);
    if (!restaurant) return ctx.notFound('Restaurante no encontrado');

    const program = await getOrCreateProgram(strapi, restaurant.id);
    ctx.body = {
      data: {
        enabled: program.enabled,
        earnMode: program.earnMode,
        redemptionTiers: program.redemptionTiers || [],
        restaurantName: restaurant.name,
        slug: restaurant.slug,
      },
    };
  },

  /** GET /loyalty/me?restaurant=slug */
  async myAccounts(ctx: any) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const slug = ctx.query?.restaurant;
    const filters: any = { users_permissions_user: userId };
    if (slug) {
      const rest = await getRestaurantBySlug(strapi, String(slug));
      if (!rest) return ctx.notFound('Restaurante no encontrado');
      filters.restaurante = rest.id;
    }

    const accounts = await strapi.entityService.findMany(ACCOUNT_UID, {
      filters,
      populate: {
        restaurante: { fields: ['id', 'name', 'slug'] },
      },
      limit: 100,
    });

    const user = await strapi.entityService.findOne(USER_UID, userId, {
      fields: ['id', 'email', 'fullname', 'username', 'birthday', 'phone'],
    });

    ctx.body = { data: { user, accounts } };
  },

  /** PUT /loyalty/profile */
  async updateProfile(ctx: any) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const body = ctx.request.body?.data || ctx.request.body || {};
    const allowed: Record<string, unknown> = {};
    if (body.fullname !== undefined) allowed.fullname = body.fullname;
    if (body.phone !== undefined) allowed.phone = body.phone;
    if (body.birthday !== undefined) allowed.birthday = body.birthday;

    const updated = await strapi.entityService.update(USER_UID, userId, { data: allowed });
    ctx.body = { data: updated };
  },

  /** GET /loyalty/transactions?accountId= */
  async myTransactions(ctx: any) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();
    const accountId = Number(ctx.query?.accountId);
    if (!accountId) return ctx.badRequest('accountId requerido');

    const account = await strapi.entityService.findOne(ACCOUNT_UID, accountId, {
      populate: { users_permissions_user: { fields: ['id'] } },
    });
    if (!account || String(account.users_permissions_user?.id || account.users_permissions_user) !== String(userId)) {
      return ctx.forbidden();
    }

    const txs = await strapi.entityService.findMany(TX_UID, {
      filters: { loyalty_account: accountId },
      sort: { createdAt: 'desc' },
      limit: 50,
    });
    ctx.body = { data: txs };
  },

  /** POST /restaurants/:slug/loyalty/redeem */
  async redeem(ctx: any) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const restaurant = await getRestaurantBySlug(strapi, ctx.params.slug);
    if (!restaurant) return ctx.notFound('Restaurante no encontrado');

    const body = ctx.request.body?.data || ctx.request.body || {};
    const tierPoints = Number(body.tierPoints);
    if (!tierPoints) return ctx.badRequest('tierPoints requerido');

    try {
      const result = await redeemPoints(strapi, userId, restaurant.id, tierPoints);
      ctx.body = { data: result };
    } catch (e: any) {
      return ctx.badRequest(e?.message || 'Error al canjear');
    }
  },

  /** GET /owner/:slug/loyalty/program */
  async ownerGetProgram(ctx: any) {
    const restauranteId = ctx.state.restauranteId;
    const program = await getOrCreateProgram(strapi, restauranteId);
    ctx.body = { data: program };
  },

  /** PUT /owner/:slug/loyalty/program */
  async ownerUpdateProgram(ctx: any) {
    const restauranteId = ctx.state.restauranteId;
    const program = await getOrCreateProgram(strapi, restauranteId);
    const body = ctx.request.body?.data || ctx.request.body || {};

    const data: Record<string, unknown> = {};
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
    if (body.earnMode !== undefined) data.earnMode = body.earnMode;
    if (body.pointsPerCurrency !== undefined) data.pointsPerCurrency = body.pointsPerCurrency;
    if (body.pointsPerVisit !== undefined) data.pointsPerVisit = body.pointsPerVisit;
    if (body.redemptionTiers !== undefined) data.redemptionTiers = body.redemptionTiers;
    if (body.minOrderToEarn !== undefined) data.minOrderToEarn = body.minOrderToEarn;

    const updated = await strapi.entityService.update(PROGRAM_UID, program.id, { data });
    ctx.body = { data: updated };
  },

  /** GET /owner/:slug/loyalty/accounts */
  async ownerListAccounts(ctx: any) {
    const restauranteId = ctx.state.restauranteId;
    const accounts = await strapi.entityService.findMany(ACCOUNT_UID, {
      filters: { restaurante: restauranteId },
      populate: {
        users_permissions_user: { fields: ['id', 'email', 'fullname', 'birthday', 'phone'] },
      },
      sort: { updatedAt: 'desc' },
      limit: 500,
    });
    ctx.body = { data: accounts };
  },

  /** POST /owner/:slug/loyalty/accounts/:accountId/adjust */
  async ownerAdjustAccount(ctx: any) {
    const restauranteId = ctx.state.restauranteId;
    const accountId = Number(ctx.params.accountId);
    const body = ctx.request.body?.data || ctx.request.body || {};
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return ctx.badRequest('delta inválido');
    }

    const account = await strapi.entityService.findOne(ACCOUNT_UID, accountId, {
      populate: { restaurante: { fields: ['id'] } },
    });
    if (!account) return ctx.notFound();
    if (String(account.restaurante?.id || account.restaurante) !== String(restauranteId)) {
      return ctx.forbidden();
    }

    const result = await adjustAccountPoints(
      strapi,
      accountId,
      delta,
      body.notes || 'Ajuste manual (owner)'
    );
    ctx.body = { data: result };
  },
};
