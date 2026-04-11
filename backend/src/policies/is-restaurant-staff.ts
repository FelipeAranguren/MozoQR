/**
 * Solo owner o staff activo del restaurante (membership o owner_email legacy).
 * Tras éxito: ctx.state.restaurantId y ctx.state.restauranteId = id numérico del restaurante.
 */

export default async (policyContext: any, _config: any, { strapi }: any) => {
  const user = policyContext.state?.user;
  if (!user?.id) {
    policyContext.unauthorized('Debes iniciar sesión');
    return false;
  }

  const slug = policyContext.params?.slug;
  if (!slug) {
    policyContext.status = 400;
    policyContext.body = { error: { message: 'Falta el identificador del restaurante' } };
    return false;
  }

  const [restaurant] = await strapi.db.query('api::restaurante.restaurante').findMany({
    where: { slug: String(slug).trim() },
    select: ['id', 'slug', 'owner_email'],
    limit: 1,
  });

  if (!restaurant?.id) {
    policyContext.notFound('Restaurante no encontrado');
    return false;
  }

  const restaurantId = Number(restaurant.id);

  let [membership] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
    where: {
      restaurante: { id: restaurantId },
      users_permissions_user: { id: user.id },
      role: { $in: ['owner', 'staff'] },
      active: true,
    },
    select: ['id'],
    limit: 1,
  });

  if (!membership && typeof user.id === 'string' && /^\d+$/.test(user.id)) {
    [membership] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
      where: {
        restaurante: { id: restaurantId },
        users_permissions_user: { id: Number(user.id) },
        role: { $in: ['owner', 'staff'] },
        active: true,
      },
      select: ['id'],
      limit: 1,
    });
  }

  if (membership) {
    policyContext.state.restaurantId = restaurantId;
    policyContext.state.restauranteId = restaurantId;
    return true;
  }

  const userEmail = user.email ? String(user.email).trim().toLowerCase() : '';
  const ownerEmail = restaurant.owner_email ? String(restaurant.owner_email).trim().toLowerCase() : '';
  if (userEmail && ownerEmail && ownerEmail === userEmail) {
    policyContext.state.restaurantId = restaurantId;
    policyContext.state.restauranteId = restaurantId;
    return true;
  }

  policyContext.forbidden('No tenés permiso para gestionar pedidos de este restaurante.');
  return false;
};
