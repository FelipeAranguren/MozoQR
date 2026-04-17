export default async (policyContext, _config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) {
    console.log('[by-restaurant-owner] ❌ No user in context');
    return false;
  }

  const slug = policyContext.params?.slug;
  if (!slug) {
    console.log('[by-restaurant-owner] ❌ No slug in params');
    return false;
  }

  console.log(`[by-restaurant-owner] 🔍 Checking access for user ${user.id} to restaurant "${slug}"`);

  /** Todos los restaurantes con ese slug (puede haber duplicados en BD); orden estable por id. */
  const restaurants = await strapi.db.query('api::restaurante.restaurante').findMany({
    where: { slug },
    select: ['id', 'slug', 'owner_email'],
    orderBy: { id: 'asc' },
    limit: 50,
  });
  if (!restaurants?.length) {
    console.log(`[by-restaurant-owner] ❌ Restaurant with slug "${slug}" not found`);
    return false;
  }

  async function membershipForRestaurant(restaurantId: number) {
    let [m] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
      where: {
        restaurante: { id: restaurantId },
        users_permissions_user: { id: user.id },
        role: { $in: ['owner', 'staff'] },
        active: true,
      },
      populate: { restaurante: { select: ['id', 'slug'] } },
      select: ['id'],
      limit: 1,
    });
    if (!m && typeof user.id === 'string' && /^\d+$/.test(user.id)) {
      [m] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
        where: {
          restaurante: { id: restaurantId },
          users_permissions_user: { id: Number(user.id) },
          role: { $in: ['owner', 'staff'] },
          active: true,
        },
        populate: { restaurante: { select: ['id', 'slug'] } },
        select: ['id'],
        limit: 1,
      });
    }
    return m ?? null;
  }

  for (const restaurant of restaurants) {
    const membership = await membershipForRestaurant(Number(restaurant.id));
    if (membership) {
      const rid = membership.restaurante?.id ?? restaurant.id;
      console.log(
        `[by-restaurant-owner] ✅ Membership found: id=${membership.id}, restauranteId=${rid} (slug=${slug})`
      );
      policyContext.state.restauranteId = rid;
      return true;
    }
  }

  console.log(
    `[by-restaurant-owner] ❌ No active membership found for user ${user.id} in any restaurant with slug "${slug}"`
  );

  const userEmail = (user as any).email ? String((user as any).email).trim().toLowerCase() : '';
  if (userEmail) {
    for (const restaurant of restaurants) {
      const ownerEmail = restaurant.owner_email
        ? String(restaurant.owner_email).trim().toLowerCase()
        : '';
      if (ownerEmail && ownerEmail === userEmail) {
        console.log(
          `[by-restaurant-owner] ✅ Allowed via owner_email match for "${slug}" restaurant id=${restaurant.id}`
        );
        policyContext.state.restauranteId = restaurant.id;
        return true;
      }
    }
  }

  const probeId = restaurants[0]?.id;
  if (probeId != null) {
    const allMemberships = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
      where: {
        restaurante: { id: probeId },
        users_permissions_user: { id: user.id },
      },
      select: ['id', 'role', 'active'],
      limit: 10,
    });
    if (allMemberships.length > 0) {
      console.log(
        `[by-restaurant-owner] ⚠️ Found ${allMemberships.length} membership(s) for first id=${probeId} but none match criteria:`,
        allMemberships.map((m) => ({ id: m.id, role: m.role, active: m.active }))
      );
    } else {
      console.log(
        `[by-restaurant-owner] ⚠️ No memberships found at all for user ${user.id} on first restaurant id=${probeId}`
      );
    }
  }

  return false;
};
