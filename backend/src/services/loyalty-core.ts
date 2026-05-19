/**
 * Lógica de fidelización: earn al pagar, canje, cuentas por restaurante.
 */

const PROGRAM_UID = 'api::loyalty-program.loyalty-program';
const ACCOUNT_UID = 'api::loyalty-account.loyalty-account';
const TX_UID = 'api::loyalty-transaction.loyalty-transaction';

export type RedemptionTier = { points: number; discountPercent: number };

export async function getRestaurantBySlug(strapi: any, slug: string) {
  const [r] = await strapi.entityService.findMany('api::restaurante.restaurante', {
    filters: { slug: String(slug).trim() },
    fields: ['id', 'name', 'slug'],
    limit: 1,
  });
  return r || null;
}

export async function getOrCreateProgram(strapi: any, restauranteId: number) {
  const [existing] = await strapi.entityService.findMany(PROGRAM_UID, {
    filters: { restaurante: restauranteId },
    limit: 1,
  });
  if (existing) return existing;

  return strapi.entityService.create(PROGRAM_UID, {
    data: {
      restaurante: restauranteId,
      enabled: false,
      earnMode: 'money',
      pointsPerCurrency: 1,
      pointsPerVisit: 1,
      redemptionTiers: [
        { points: 100, discountPercent: 10 },
        { points: 200, discountPercent: 15 },
      ],
    },
  });
}

export async function getOrCreateAccount(
  strapi: any,
  userId: number,
  restauranteId: number
) {
  const [existing] = await strapi.entityService.findMany(ACCOUNT_UID, {
    filters: {
      users_permissions_user: userId,
      restaurante: restauranteId,
    },
    limit: 1,
  });
  if (existing) return existing;

  return strapi.entityService.create(ACCOUNT_UID, {
    data: {
      users_permissions_user: userId,
      restaurante: restauranteId,
      pointsBalance: 0,
      lifetimePoints: 0,
    },
  });
}

function calcEarnPoints(program: any, orderTotal: number): number {
  const mode = program.earnMode || 'money';
  let pts = 0;
  const minOrder = Number(program.minOrderToEarn || 0);
  if (minOrder > 0 && orderTotal < minOrder) return 0;

  if (mode === 'money' || mode === 'both') {
    const per = Number(program.pointsPerCurrency || 1);
    if (per > 0 && orderTotal > 0) {
      pts += Math.floor(orderTotal / 100) * per;
    }
  }
  if (mode === 'visit' || mode === 'both') {
    pts += Number(program.pointsPerVisit || 1);
  }
  return Math.max(0, pts);
}

export async function creditLoyaltyForPaidOrder(strapi: any, pedidoId: number) {
  const pedido = await strapi.entityService.findOne('api::pedido.pedido', pedidoId, {
    fields: ['id', 'total', 'order_status', 'loyalty_points_earned'],
    populate: {
      restaurante: { fields: ['id'] },
      users_permissions_user: { fields: ['id'] },
    },
  });
  if (!pedido || pedido.order_status !== 'paid') return;
  if (pedido.loyalty_points_earned != null && Number(pedido.loyalty_points_earned) > 0) return;

  const userId = pedido.users_permissions_user?.id ?? pedido.users_permissions_user;
  const restauranteId = pedido.restaurante?.id ?? pedido.restaurante;
  if (!userId || !restauranteId) return;

  const program = await getOrCreateProgram(strapi, Number(restauranteId));
  if (!program.enabled) return;

  const idempotencyKey = `earn:pedido:${pedidoId}`;
  const [dup] = await strapi.entityService.findMany(TX_UID, {
    filters: { idempotencyKey },
    limit: 1,
  });
  if (dup) return;

  const points = calcEarnPoints(program, Number(pedido.total || 0));
  if (points <= 0) return;

  const account = await getOrCreateAccount(strapi, Number(userId), Number(restauranteId));
  const newBalance = Number(account.pointsBalance || 0) + points;
  const newLifetime = Number(account.lifetimePoints || 0) + points;

  await strapi.entityService.update(ACCOUNT_UID, account.id, {
    data: { pointsBalance: newBalance, lifetimePoints: newLifetime },
  });

  await strapi.entityService.create(TX_UID, {
    data: {
      loyalty_account: account.id,
      pedido: pedidoId,
      delta: points,
      reason: 'earn',
      idempotencyKey,
      notes: `Puntos por pedido #${pedidoId}`,
    },
  });

  await strapi.entityService.update('api::pedido.pedido', pedidoId, {
    data: { loyalty_points_earned: points },
  });

  strapi.log?.info?.(`[loyalty] +${points} pts user=${userId} restaurante=${restauranteId} pedido=${pedidoId}`);
}

export async function redeemPoints(
  strapi: any,
  userId: number,
  restauranteId: number,
  tierPoints: number
): Promise<{ discountPercent: number; pointsRedeemed: number; newBalance: number }> {
  const program = await getOrCreateProgram(strapi, restauranteId);
  if (!program.enabled) {
    throw new Error('Programa de fidelización no activo');
  }

  const tiers: RedemptionTier[] = Array.isArray(program.redemptionTiers)
    ? program.redemptionTiers
    : [];
  const tier = tiers.find((t) => Number(t.points) === Number(tierPoints));
  if (!tier) {
    throw new Error('Nivel de canje inválido');
  }

  const account = await getOrCreateAccount(strapi, userId, restauranteId);
  const balance = Number(account.pointsBalance || 0);
  if (balance < tier.points) {
    throw new Error('Puntos insuficientes');
  }

  const idempotencyKey = `redeem:${userId}:${restauranteId}:${Date.now()}`;
  const newBalance = balance - tier.points;

  await strapi.entityService.update(ACCOUNT_UID, account.id, {
    data: { pointsBalance: newBalance },
  });

  await strapi.entityService.create(TX_UID, {
    data: {
      loyalty_account: account.id,
      delta: -tier.points,
      reason: 'redeem',
      idempotencyKey,
      notes: `Canje ${tier.discountPercent}% descuento`,
    },
  });

  return {
    discountPercent: Number(tier.discountPercent),
    pointsRedeemed: tier.points,
    newBalance,
  };
}

export async function adjustAccountPoints(
  strapi: any,
  accountId: number,
  delta: number,
  notes: string
) {
  const account = await strapi.entityService.findOne(ACCOUNT_UID, accountId, {
    fields: ['id', 'pointsBalance', 'lifetimePoints'],
  });
  if (!account) throw new Error('Cuenta no encontrada');

  const newBalance = Math.max(0, Number(account.pointsBalance || 0) + delta);
  const newLifetime =
    delta > 0
      ? Number(account.lifetimePoints || 0) + delta
      : Number(account.lifetimePoints || 0);

  await strapi.entityService.update(ACCOUNT_UID, accountId, {
    data: { pointsBalance: newBalance, lifetimePoints: newLifetime },
  });

  await strapi.entityService.create(TX_UID, {
    data: {
      loyalty_account: accountId,
      delta,
      reason: 'adjust',
      idempotencyKey: `adjust:${accountId}:${Date.now()}`,
      notes,
    },
  });

  return { pointsBalance: newBalance, lifetimePoints: newLifetime };
}
