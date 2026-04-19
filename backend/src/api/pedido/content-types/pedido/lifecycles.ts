import { safeDeductStockForPaidOrder } from '../../services/deduct-stock-for-order';

/** En algunos despliegues `strapi` global no está en lifecycles; alineado con `stock-movement/lifecycles.ts`. */
function getStrapiApp(): any {
  const g = typeof global !== 'undefined' ? (global as any) : null;
  return g?.__STRAPI__ ?? g?.strapi ?? null;
}

export default {
  async beforeCreate(event: any) {
    const app = getStrapiApp();
    if (!app) return;

    const { data } = event.params;

    // Si ya tiene mesaNumber, no hacer nada
    if (data.mesaNumber) {
      return;
    }

    // Si tiene mesa_sesion, obtener el número de mesa
    if (data.mesa_sesion?.id) {
      try {
        const sesion: any = await app.entityService.findOne(
          'api::mesa-sesion.mesa-sesion',
          data.mesa_sesion.id,
          {
            populate: ['mesa'],
            publicationState: 'preview',
          },
        );

        if (sesion?.mesa?.number) {
          data.mesaNumber = sesion.mesa.number;
        }
      } catch (err) {
        console.error('[pedido lifecycles] Error obteniendo mesaNumber en beforeCreate:', err);
      }
    }
  },

  async beforeUpdate(event: any) {
    const app = getStrapiApp();
    if (!app) return;

    const { data } = event.params;

    // Si ya tiene mesaNumber y no se está actualizando mesa_sesion, no hacer nada
    if (data.mesaNumber && !data.mesa_sesion) {
      return;
    }

    // Si se está actualizando la mesa_sesion, obtener el nuevo número de mesa
    if (data.mesa_sesion?.id) {
      try {
        const sesion: any = await app.entityService.findOne(
          'api::mesa-sesion.mesa-sesion',
          data.mesa_sesion.id,
          {
            populate: ['mesa'],
            publicationState: 'preview',
          },
        );

        if (sesion?.mesa?.number) {
          data.mesaNumber = sesion.mesa.number;
        }
      } catch (err) {
        console.error('[pedido lifecycles] Error obteniendo mesaNumber en beforeUpdate:', err);
      }
    }
  },

  async afterUpdate(event: any) {
    const app = getStrapiApp();
    if (!app) {
      console.error('[pedido lifecycles] afterUpdate: instancia Strapi no disponible (__STRAPI__/strapi).');
      return;
    }

    const result = event?.result;
    if (!result) return;

    const orderRefForLookup = result.id ?? (result as { documentId?: string }).documentId;
    if (orderRefForLookup == null || orderRefForLookup === '') return;

    const data = event?.params?.data as { order_status?: string } | undefined;
    const orderStatus = data?.order_status ?? result.order_status;

    if (orderStatus !== 'paid') return;

    app.log?.info?.(
      `[pedido lifecycle] afterUpdate paid → inventario pedido ref=${String(orderRefForLookup)} ` +
        `data.order_status=${data?.order_status ?? 'n/a'} result.order_status=${result.order_status ?? 'n/a'}`,
    );

    let restauranteId: number | null = null;
    const r = result.restaurante;
    if (typeof r === 'number') restauranteId = r;
    else if (r && typeof r === 'object' && 'id' in r) restauranteId = Number((r as { id: number }).id);
    else if (r != null) restauranteId = Number(r);

    if (restauranteId == null || !Number.isFinite(restauranteId)) {
      try {
        const full = (await app.entityService.findOne('api::pedido.pedido', orderRefForLookup, {
          fields: ['id'],
          populate: { restaurante: { fields: ['id'] } },
        })) as { restaurante?: { id?: number } | number } | null;
        const rr = full?.restaurante as { id?: number } | number | undefined;
        if (typeof rr === 'number') restauranteId = rr;
        else if (rr && typeof rr === 'object' && rr.id != null) restauranteId = Number(rr.id);
      } catch (e) {
        console.error('[pedido lifecycles] afterUpdate: no se pudo resolver restaurante', e);
        return;
      }
    }

    if (restauranteId != null && Number.isFinite(restauranteId)) {
      app.log?.info?.(
        `[pedido lifecycle] safeDeductStockForPaidOrder ref=${String(orderRefForLookup)} restauranteId=${restauranteId}`,
      );
      await safeDeductStockForPaidOrder(app, orderRefForLookup, restauranteId);
    } else {
      app.log?.warn?.(
        `[pedido lifecycle] afterUpdate paid pero sin restauranteId; no se descuenta stock (ref=${String(orderRefForLookup)}).`,
      );
    }
  },
};
