export default async (policyContext, _config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return true; 

  const slug = policyContext.params?.slug;
  if (!slug) return false;

  // (opcional) validar que exista el restaurant
  const [restaurant] = await strapi.db.query('api::restaurante.restaurante').findMany({
    where: { slug }, select: ['id','slug'], limit: 1,
  });
  if (!restaurant) return false;

  // validar membership (por slug + user)
  const [membership] = await strapi.db.query('api::restaurant-member.restaurant-member').findMany({
    where: {
      restaurante: { slug },
      users_permissions_user: { id: user.id },
      role: 'owner',
      active: true,
    },
    populate: { restaurante: { select: ['id','slug'] } },
    select: ['id'],
    limit: 1,
  });
  if (!membership) return false;

  policyContext.state.restauranteId = membership.restaurante?.id ?? restaurant.id;
  return true;
};
