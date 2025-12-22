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

  // (opcional) validar que exista el restaurant
  const [restaurant] = await strapi.db.query('api::restaurante.restaurante').findMany({
    where: { slug }, select: ['id','slug'], limit: 1,
  });
  if (!restaurant) {
    console.log(`[by-restaurant-owner] ❌ Restaurant with slug "${slug}" not found`);
    return false;
  }

  console.log(`[by-restaurant-owner] ✅ Restaurant found: id=${restaurant.id}, slug=${restaurant.slug}`);

  // validar membership (por slug + user)
  const [membership] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
    where: {
      restaurante: { slug },
      users_permissions_user: { id: user.id },
      role: { $in: ['owner', 'staff'] },
      active: true,
    },
    populate: { restaurante: { select: ['id','slug'] } },
    select: ['id'],
    limit: 1,
  });
  
  if (!membership) {
    console.log(`[by-restaurant-owner] ❌ No active membership found for user ${user.id} in restaurant "${slug}"`);
    
    // Debug: verificar si hay memberships inactivos o con otro rol
    const allMemberships = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
      where: {
        restaurante: { slug },
        users_permissions_user: { id: user.id },
      },
      select: ['id', 'role', 'active'],
      limit: 10,
    });
    
    if (allMemberships.length > 0) {
      console.log(`[by-restaurant-owner] ⚠️ Found ${allMemberships.length} membership(s) but none match criteria:`, 
        allMemberships.map(m => ({ id: m.id, role: m.role, active: m.active }))
      );
    } else {
      console.log(`[by-restaurant-owner] ⚠️ No memberships found at all for user ${user.id} in restaurant "${slug}"`);
    }
    
    return false;
  }

  console.log(`[by-restaurant-owner] ✅ Membership found: id=${membership.id}, restauranteId=${membership.restaurante?.id ?? restaurant.id}`);

  policyContext.state.restauranteId = membership.restaurante?.id ?? restaurant.id;
  return true;
};
