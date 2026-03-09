/**
 * Controller para obtener y actualizar el método de pago Mercado Pago de un restaurante.
 * Rutas: GET/PUT /restaurants/:slug/payment-method
 * - Evita duplicados: siempre actualiza el existente en lugar de crear uno nuevo.
 * - Expone mp_access_token para que el owner pueda verlo en la UI (solo en este endpoint).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const METODOS_PAGO_UID = 'api::metodos-pago.metodos-pago';
const RESTAURANTE_UID = 'api::restaurante.restaurante';

function findMercadoPagoActivo(rows: any[]): any {
  const list = Array.isArray(rows) ? rows : [];
  return list.find((r: any) => {
    const provider = r?.provider;
    const active = r?.active;
    return provider === 'mercado_pago' && (active === true || active === 1);
  }) ?? null;
}

export default {
  /**
   * GET /restaurants/:slug/payment-method
   * Devuelve el método Mercado Pago del restaurante (incluye mp_access_token para el owner).
   */
  async find(ctx: any) {
    const slug = ctx.params?.slug;
    if (!slug) {
      return ctx.badRequest('Slug requerido');
    }

    const strapi = ctx.strapi;
    if (!strapi?.entityService) {
      return ctx.internalServerError('Strapi no disponible');
    }

    try {
      const [restaurante] = await strapi.entityService.findMany(RESTAURANTE_UID, {
        filters: { slug: String(slug).trim() },
        fields: ['id'],
        limit: 1,
      });
      if (!restaurante?.id) {
        return ctx.notFound('Restaurante no encontrado');
      }

      const restauranteId = restaurante.id ?? restaurante.attributes?.id;
      const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
        filters: { restaurante: restauranteId },
        limit: 50,
      });
      const metodo = findMercadoPagoActivo(rows);
      if (!metodo) {
        return ctx.body = { data: null };
      }

      const attrs = metodo.attributes ?? metodo;
      ctx.body = {
        data: {
          id: metodo.id,
          documentId: metodo.documentId ?? metodo.id,
          mp_public_key: attrs.mp_public_key ?? metodo.mp_public_key ?? '',
          mp_access_token: attrs.mp_access_token ?? metodo.mp_access_token ?? '',
        },
      };
    } catch (e) {
      console.error('[payment-method.find]', e);
      return ctx.internalServerError('Error al obtener el método de pago');
    }
  },

  /**
   * PUT /restaurants/:slug/payment-method
   * Actualiza el método existente o crea uno nuevo si no existe.
   * Nunca crea duplicados: siempre actualiza el registro existente para ese restaurante.
   */
  async update(ctx: any) {
    const slug = ctx.params?.slug;
    if (!slug) {
      return ctx.badRequest('Slug requerido');
    }

    const strapi = ctx.strapi;
    if (!strapi?.entityService) {
      return ctx.internalServerError('Strapi no disponible');
    }

    const body = ctx.request?.body;
    const data = body?.data ?? body;
    if (!data || typeof data !== 'object') {
      return ctx.badRequest('Datos inválidos');
    }

    const mp_public_key = data.mp_public_key ?? null;
    const mp_access_token = data.mp_access_token ?? undefined;

    try {
      const [restaurante] = await strapi.entityService.findMany(RESTAURANTE_UID, {
        filters: { slug: String(slug).trim() },
        fields: ['id'],
        limit: 1,
      });
      if (!restaurante?.id) {
        return ctx.notFound('Restaurante no encontrado');
      }

      const restauranteId = restaurante.id ?? restaurante.attributes?.id;
      const rows = await strapi.entityService.findMany(METODOS_PAGO_UID, {
        filters: { restaurante: restauranteId },
        limit: 50,
      });
      const existing = findMercadoPagoActivo(rows);

      const updateData: any = {
        provider: 'mercado_pago',
        mp_public_key: mp_public_key != null ? String(mp_public_key) : undefined,
        active: true,
        restaurante: restauranteId,
      };
      if (mp_access_token !== undefined && mp_access_token !== null && String(mp_access_token).trim() !== '') {
        updateData.mp_access_token = String(mp_access_token).trim();
      }

      if (existing) {
        const updated = await strapi.entityService.update(METODOS_PAGO_UID, existing.id, {
          data: updateData,
        });
        const attrs = updated?.attributes ?? updated;
        ctx.body = {
          data: {
            id: updated?.id,
            documentId: updated?.documentId ?? updated?.id,
            mp_public_key: attrs?.mp_public_key ?? '',
          },
        };
      } else {
        const created = await strapi.entityService.create(METODOS_PAGO_UID, {
          data: {
            ...updateData,
            mp_public_key: updateData.mp_public_key ?? '',
          },
        });
        const attrs = created?.attributes ?? created;
        ctx.body = {
          data: {
            id: created?.id,
            documentId: created?.documentId ?? created?.id,
            mp_public_key: attrs?.mp_public_key ?? '',
          },
        };
      }
    } catch (e) {
      console.error('[payment-method.update]', e);
      return ctx.internalServerError('Error al guardar el método de pago');
    }
  },
};
