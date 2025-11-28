// backend/src/api/restaurante/controllers/owner.ts
import { getBackendUrl } from '../../../config/urls';

declare const strapi: any;

export default {
  async ownerAuthzCheck(ctx: any) {
    ctx.body = {
      ok: true,
      slug: ctx.params.slug,
      restauranteId: ctx.state.restauranteId ?? null,
      userId: ctx.state.user?.id ?? null,
    };
  },

  /**
   * GET /api/owner/restaurants
   * Lista todos los restaurantes donde el usuario es owner o staff
   * Incluye KPIs básicos: ventas del día, total pedidos, plan
   */
  async listRestaurants(ctx: any) {
    const user = ctx.state.user;

    if (!user?.id) {
      return ctx.unauthorized('Usuario no autenticado');
    }

    // Obtener todos los memberships del usuario (owner o staff)
    const memberships = await strapi.entityService.findMany('api::restaurant-member.restaurant-member', {
      filters: {
        users_permissions_user: { id: user.id },
        role: { $in: ['owner', 'staff'] },
        active: true,
      },
      populate: {
        restaurante: {
          fields: ['id', 'name', 'slug', 'Suscripcion'],
          populate: {
            logo: {
              fields: ['url'],
            },
          },
        },
      },
      publicationState: 'live',
      limit: 100,
    });

    if (!memberships || memberships.length === 0) {
      ctx.body = { data: [] };
      return;
    }

    // Obtener IDs de restaurantes
    const restauranteIds = memberships
      .map((m: any) => m.restaurante?.id)
      .filter((id: any) => id != null);

    if (restauranteIds.length === 0) {
      ctx.body = { data: [] };
      return;
    }

    // Calcular KPIs para cada restaurante
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const restaurantsWithKpis = await Promise.all(
      restauranteIds.map(async (restauranteId: number) => {
        // Obtener restaurante completo
        const restaurante = memberships.find((m: any) => m.restaurante?.id === restauranteId)?.restaurante;
        if (!restaurante) return null;

        // Ventas del día (pedidos pagados hoy)
        // Optimizacion: Fetch only total field
        const paidToday = await strapi.entityService.findMany('api::pedido.pedido', {
          filters: {
            restaurante: { id: restauranteId },
            order_status: 'paid',
            createdAt: { $gte: startOfToday, $lte: endOfToday },
          },
          fields: ['total'],
          limit: 1000,
        });

        const salesToday = (paidToday || []).reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);

        // Total de pedidos pagados (lifetime)
        // Optimizacion: Use count() instead of findMany
        const totalOrders = await strapi.db.query('api::pedido.pedido').count({
          where: {
            restaurante: { id: restauranteId },
            order_status: 'paid',
          },
        });

        // Logo URL
        const logoUrl = restaurante.logo?.url || restaurante.logo?.data?.attributes?.url || null;
        const publicUrl = getBackendUrl(strapi.config);
        const fullLogoUrl = logoUrl && !logoUrl.startsWith('http') ? `${publicUrl}${logoUrl}` : logoUrl;

        return {
          id: restaurante.id,
          name: restaurante.name,
          slug: restaurante.slug,
          plan: (restaurante.Suscripcion || 'basic').toUpperCase(),
          logo: fullLogoUrl,
          kpis: {
            salesToday,
            totalOrders,
          },
        };
      })
    );

    // Filtrar nulls y ordenar por nombre
    const filtered = restaurantsWithKpis.filter((r: any) => r != null).sort((a: any, b: any) => a.name.localeCompare(b.name));

    ctx.body = { data: filtered };
  },
};