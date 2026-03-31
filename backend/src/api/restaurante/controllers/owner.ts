// backend/src/api/restaurante/controllers/owner.ts
import { getBackendUrl } from '../../../config/urls';
import {
  buildOrderHistorySummary,
  generateWeeklyReportMarkdown,
  isWeeklyCacheFresh,
  WEEK_MS,
} from '../../../services/weekly-ai-report';

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

  /**
   * GET /api/owner/:slug/weekly-ai-report
   * Informe semanal con IA (Gemini). Máximo 1 generación nueva cada 7 días por restaurante (caché en BD).
   * Query: force=1 para forzar regeneración (solo uso interno / soporte).
   */
  async weeklyAiReport(ctx: any) {
    const restauranteId = ctx.state.restauranteId;
    const slug = ctx.params?.slug;
    const force =
      ctx.query?.force === 'true' ||
      ctx.query?.force === '1' ||
      ctx.query?.force === true;

    if (!restauranteId || !slug) {
      return ctx.badRequest('Falta restaurante');
    }

    const rest = await strapi.entityService.findOne('api::restaurante.restaurante', restauranteId, {
      fields: ['name', 'Suscripcion', 'weekly_ai_report_markdown', 'weekly_ai_generated_at'],
    });

    if (!rest) {
      return ctx.notFound('Restaurante no encontrado');
    }

    const plan = String(rest.Suscripcion || 'basic').toLowerCase();
    if (plan !== 'ultra') {
      return ctx.forbidden('El informe con IA requiere plan Ultra');
    }

    const cachedMarkdown = rest.weekly_ai_report_markdown;
    const generatedAt = rest.weekly_ai_generated_at;

    if (!force && cachedMarkdown && isWeeklyCacheFresh(generatedAt)) {
      const genTime = new Date(generatedAt as string).getTime();
      ctx.body = {
        ok: true,
        cached: true,
        generatedAt,
        nextRefreshApprox: new Date(genTime + WEEK_MS).toISOString(),
        reportMarkdown: cachedMarkdown,
        missingApiKey: false,
      };
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
      ctx.body = {
        ok: false,
        cached: false,
        missingApiKey: true,
        generatedAt: generatedAt || null,
        reportMarkdown: cachedMarkdown || null,
        message:
          'Falta GEMINI_API_KEY en el servidor. Creá una clave gratis en Google AI Studio (https://aistudio.google.com/apikey) y configurá la variable en el hosting.',
      };
      return;
    }

    try {
      const summary = await buildOrderHistorySummary(strapi, restauranteId, rest.name || slug);
      const reportMarkdown = await generateWeeklyReportMarkdown(apiKey, summary);
      const nowIso = new Date().toISOString();

      await strapi.entityService.update('api::restaurante.restaurante', restauranteId, {
        data: {
          weekly_ai_report_markdown: reportMarkdown,
          weekly_ai_generated_at: nowIso,
        },
      });

      ctx.body = {
        ok: true,
        cached: false,
        generatedAt: nowIso,
        nextRefreshApprox: new Date(Date.now() + WEEK_MS).toISOString(),
        reportMarkdown,
        missingApiKey: false,
      };
    } catch (err: any) {
      strapi.log.error('[weeklyAiReport]', err);
      ctx.status = 502;
      ctx.body = {
        ok: false,
        cached: false,
        missingApiKey: false,
        error: err?.message || 'Error al generar el informe',
        reportMarkdown: cachedMarkdown || null,
        generatedAt: generatedAt || null,
      };
    }
  },
};