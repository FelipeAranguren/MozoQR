/**
 * Controller para obtener y actualizar el método de pago Mercado Pago de un restaurante.
 * Rutas: GET/PUT /restaurants/:slug/payment-method
 * - Evita duplicados: siempre actualiza el existente en lugar de crear uno nuevo.
 * - Usa db.query para leer mp_access_token (entityService puede omitir atributos private).
 * - Usa db.query().update() para que los cambios persistan en la base.
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
   * Devuelve el método Mercado Pago del restaurante (incluye mp_access_token).
   * Usamos db.query para obtener todos los campos, incluido el private mp_access_token.
   */
  async find(ctx: any) {
    const slug = ctx.params?.slug;
    if (!slug) {
      return ctx.badRequest('Slug requerido');
    }

    const strapi = ctx.strapi;
    if (!strapi?.db) {
      return ctx.internalServerError('Strapi no disponible');
    }

    try {
      const [restaurante] = await strapi.db.query(RESTAURANTE_UID).findMany({
        where: { slug: String(slug).trim() },
        select: ['id'],
        limit: 1,
      });
      if (!restaurante?.id) {
        return ctx.notFound('Restaurante no encontrado');
      }

      const rows = await strapi.db.query(METODOS_PAGO_UID).findMany({
        where: { restaurante: restaurante.id },
        limit: 50,
      });
      const metodo = findMercadoPagoActivo(rows);
      if (!metodo) {
        ctx.body = { data: null };
        return;
      }

      ctx.body = {
        data: {
          id: metodo.id,
          documentId: metodo.documentId ?? metodo.id,
          mp_public_key: metodo.mp_public_key ?? '',
          mp_access_token: metodo.mp_access_token ?? '',
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
   * Usamos db.query().update() para que los cambios persistan.
   */
  async update(ctx: any) {
    const slug = ctx.params?.slug;
    if (!slug) {
      return ctx.badRequest('Slug requerido');
    }

    const strapi = ctx.strapi;
    if (!strapi?.db) {
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
      const [restaurante] = await strapi.db.query(RESTAURANTE_UID).findMany({
        where: { slug: String(slug).trim() },
        select: ['id'],
        limit: 1,
      });
      if (!restaurante?.id) {
        return ctx.notFound('Restaurante no encontrado');
      }

      const rows = await strapi.db.query(METODOS_PAGO_UID).findMany({
        where: { restaurante: restaurante.id },
        limit: 50,
      });
      const existing = findMercadoPagoActivo(rows);

      if (existing) {
        const updatePayload: any = {
          provider: 'mercado_pago',
          active: true,
          restaurante: restaurante.id,
        };
        if (mp_public_key != null) updatePayload.mp_public_key = String(mp_public_key).trim();
        if (mp_access_token !== undefined && mp_access_token !== null && String(mp_access_token).trim() !== '') {
          updatePayload.mp_access_token = String(mp_access_token).trim();
        }
        await strapi.db.query(METODOS_PAGO_UID).update({
          where: { id: existing.id },
          data: updatePayload,
        });
        const updated = await strapi.db.query(METODOS_PAGO_UID).findOne({
          where: { id: existing.id },
        });
        ctx.body = {
          data: {
            id: updated?.id,
            documentId: updated?.documentId ?? updated?.id,
            mp_public_key: updated?.mp_public_key ?? '',
          },
        };
      } else {
        const createPayload: any = {
          provider: 'mercado_pago',
          mp_public_key: mp_public_key != null ? String(mp_public_key).trim() : '',
          active: true,
          restaurante: restaurante.id,
        };
        if (mp_access_token !== undefined && mp_access_token !== null && String(mp_access_token).trim() !== '') {
          createPayload.mp_access_token = String(mp_access_token).trim();
        }
        const created = await strapi.entityService.create(METODOS_PAGO_UID, {
          data: createPayload,
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
