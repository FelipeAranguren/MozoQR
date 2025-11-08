// backend/src/api/restaurante/controllers/owner.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
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
    let user = ctx.state.user;
    
    // Log para debug
    strapi?.log?.info?.('[owner.listRestaurants] Usuario inicial:', user?.id || 'NO AUTENTICADO');
    strapi?.log?.info?.('[owner.listRestaurants] Headers:', JSON.stringify(ctx.request.headers || {}));
    
    // Verificar autenticación manualmente (ya que auth: false temporalmente)
    if (!user?.id) {
      // Intentar obtener el usuario desde el token manualmente
      const authHeader = ctx.request.headers?.authorization || ctx.request.header?.authorization || ctx.headers?.authorization;
      strapi?.log?.info?.('[owner.listRestaurants] Auth header:', authHeader ? 'Presente' : 'Ausente');
      
      const token = authHeader?.replace(/^Bearer\s+/i, '') || authHeader?.replace(/^bearer\s+/i, '');
      strapi?.log?.info?.('[owner.listRestaurants] Token extraído:', token ? 'Sí' : 'No');
      
      if (token) {
        try {
          const jwtService = strapi.plugin('users-permissions').service('jwt');
          const decoded = await jwtService.verify(token);
          strapi?.log?.info?.('[owner.listRestaurants] Token decodificado:', decoded?.id || 'N/A');
          
          if (decoded?.id) {
            const foundUser = await strapi.entityService.findOne('plugin::users-permissions.user', decoded.id);
            if (foundUser) {
              user = foundUser;
              ctx.state.user = foundUser;
              strapi?.log?.info?.('[owner.listRestaurants] Usuario encontrado desde token:', foundUser.id, foundUser.username);
            } else {
              strapi?.log?.warn?.('[owner.listRestaurants] Usuario no encontrado en BD con ID:', decoded.id);
            }
          }
        } catch (err: any) {
          strapi?.log?.warn?.('[owner.listRestaurants] Error verificando token:', err?.message || err);
        }
      } else {
        strapi?.log?.warn?.('[owner.listRestaurants] No hay token en el header');
      }
    }
    
    if (!user?.id) {
      strapi?.log?.warn?.('[owner.listRestaurants] Usuario no autenticado - retornando 401');
      ctx.status = 401;
      ctx.body = { error: { message: 'Usuario no autenticado' } };
      return;
    }
    
    const finalUser = user;

    // Obtener todos los memberships del usuario (owner o staff)
    strapi?.log?.info?.('[owner.listRestaurants] Buscando memberships para usuario:', finalUser.id);
    
    const memberships = await strapi.entityService.findMany('api::restaurant-member.restaurant-member', {
      filters: {
        users_permissions_user: { id: finalUser.id },
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

    strapi?.log?.info?.('[owner.listRestaurants] Memberships encontrados:', memberships?.length || 0);

    if (!memberships || memberships.length === 0) {
      strapi?.log?.info?.('[owner.listRestaurants] No hay memberships, retornando array vacío');
      ctx.body = { data: [] };
      return;
    }

    // Obtener IDs de restaurantes
    const restauranteIds = memberships
      .map((m) => m.restaurante?.id)
      .filter((id) => id != null);

    if (restauranteIds.length === 0) {
      ctx.body = { data: [] };
      return;
    }

    // Calcular KPIs para cada restaurante
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const restaurantsWithKpis = await Promise.all(
      restauranteIds.map(async (restauranteId) => {
        // Obtener restaurante completo
        const restaurante = memberships.find((m) => m.restaurante?.id === restauranteId)?.restaurante;
        if (!restaurante) return null;

        // Ventas del día (pedidos pagados hoy)
        const paidToday = await strapi.entityService.findMany('api::pedido.pedido', {
          filters: {
            restaurante: { id: restauranteId },
            order_status: 'paid',
            createdAt: { $gte: startOfToday, $lte: endOfToday },
          },
          fields: ['id', 'total'],
          limit: 1000,
        });

        const salesToday = (paidToday || []).reduce((sum, p) => sum + Number(p.total || 0), 0);

        // Total de pedidos pagados (lifetime) - usar paginación para obtener el total
        // Hacemos una query con paginación para obtener el total desde la metadata
        let totalOrders = 0;
        try {
          // Intentar obtener el total desde la metadata de paginación
          const totalPaidResult = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: {
              restaurante: { id: restauranteId },
              order_status: 'paid',
            },
            fields: ['id'],
            pagination: { page: 1, pageSize: 1 },
          });
          
          // Si el resultado tiene metadata con paginación, usar el total
          // Nota: entityService.findMany puede no devolver metadata directamente
          // En ese caso, hacemos un fallback: contamos todos los pedidos (limit alto)
          const allPaid = await strapi.entityService.findMany('api::pedido.pedido', {
            filters: {
              restaurante: { id: restauranteId },
              order_status: 'paid',
            },
            fields: ['id'],
            limit: 10000, // límite alto para contar todos
          });
          totalOrders = (allPaid || []).length;
        } catch (err) {
          // Si falla, usar 0
          totalOrders = 0;
        }

        // Logo URL
        const logoUrl = restaurante.logo?.url || restaurante.logo?.data?.attributes?.url || null;
        const publicUrl = strapi.config.get('server.url', 'http://localhost:1337');
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
    const filtered = restaurantsWithKpis.filter((r) => r != null).sort((a, b) => a.name.localeCompare(b.name));

    ctx.body = { data: filtered };
  },
};