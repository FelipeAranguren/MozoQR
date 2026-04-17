declare const strapi: any;

async function getOpenCaja(strapi: any, restauranteId: number) {
  const [caja] = await strapi.entityService.findMany('api::caja-sesion.caja-sesion', {
    filters: { restaurante: { id: restauranteId }, status: 'open' },
    sort: { opened_at: 'desc' },
    populate: { opened_by: { fields: ['id', 'username', 'fullname'] } },
    limit: 1,
  });
  return caja || null;
}

export default {
  async abrir(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const { initial_balance = 0, notes } = ctx.request.body?.data || ctx.request.body || {};

    const existing = await getOpenCaja(strapi, restauranteId);
    if (existing) {
      return ctx.badRequest('Ya hay una caja abierta. Cerrala antes de abrir una nueva.');
    }

    const now = new Date().toISOString();
    const caja = await strapi.entityService.create('api::caja-sesion.caja-sesion', {
      data: {
        status: 'open',
        initial_balance: Number(initial_balance) || 0,
        total_ingresos: 0,
        total_egresos: 0,
        opened_at: now,
        notes: notes || null,
        restaurante: restauranteId,
        opened_by: user?.id || null,
      },
    });

    if (Number(initial_balance) > 0) {
      await strapi.entityService.create('api::movimiento-caja.movimiento-caja', {
        data: {
          type: 'ingreso',
          amount: Number(initial_balance),
          concept: 'Fondo inicial de caja',
          category: 'fondo_inicial',
          payment_method: 'efectivo',
          timestamp: now,
          caja_sesion: caja.id,
          created_by_user: user?.id || null,
        },
      });
    }

    ctx.body = { data: caja };
  },

  async cerrar(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const { notes } = ctx.request.body?.data || ctx.request.body || {};

    const caja = await getOpenCaja(strapi, restauranteId);
    if (!caja) {
      return ctx.badRequest('No hay caja abierta para cerrar.');
    }

    const movimientos = await strapi.entityService.findMany('api::movimiento-caja.movimiento-caja', {
      filters: { caja_sesion: caja.id },
      fields: ['type', 'amount'],
      limit: 10000,
    });

    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of movimientos) {
      const amt = Number(m.amount) || 0;
      if (m.type === 'ingreso') totalIngresos += amt;
      else totalEgresos += amt;
    }

    const finalBalance = (Number(caja.initial_balance) || 0) + totalIngresos - totalEgresos;
    const now = new Date().toISOString();

    const updated = await strapi.entityService.update('api::caja-sesion.caja-sesion', caja.id, {
      data: {
        status: 'closed',
        closed_at: now,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        final_balance: finalBalance,
        closed_by: user?.id || null,
        notes: notes ? `${caja.notes || ''}\n--- Cierre ---\n${notes}`.trim() : caja.notes,
      },
    });

    ctx.body = {
      data: {
        ...updated,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        final_balance: finalBalance,
        movimientos_count: movimientos.length,
      },
    };
  },

  async actual(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;

    const caja = await getOpenCaja(strapi, restauranteId);
    if (!caja) {
      ctx.body = { data: null, meta: { open: false } };
      return;
    }

    const movimientos = await strapi.entityService.findMany('api::movimiento-caja.movimiento-caja', {
      filters: { caja_sesion: caja.id },
      fields: ['type', 'amount', 'concept', 'category', 'payment_method', 'timestamp', 'notes'],
      populate: { pedido: { fields: ['id', 'total'] }, created_by_user: { fields: ['id', 'username', 'fullname'] } },
      sort: { timestamp: 'desc' },
      limit: 10000,
    });

    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of movimientos) {
      const amt = Number(m.amount) || 0;
      if (m.type === 'ingreso') totalIngresos += amt;
      else totalEgresos += amt;
    }

    const balance = (Number(caja.initial_balance) || 0) + totalIngresos - totalEgresos;

    ctx.body = {
      data: {
        ...caja,
        movimientos,
        computed: { total_ingresos: totalIngresos, total_egresos: totalEgresos, balance },
      },
      meta: { open: true },
    };
  },

  async historial(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const { desde, hasta, page = 1, pageSize = 20 } = ctx.request.query || {};

    const filters: any = { restaurante: { id: restauranteId }, status: 'closed' };
    if (desde || hasta) {
      filters.closed_at = {};
      if (desde) filters.closed_at.$gte = desde;
      if (hasta) filters.closed_at.$lte = hasta;
    }

    const sesiones = await strapi.entityService.findMany('api::caja-sesion.caja-sesion', {
      filters,
      sort: { closed_at: 'desc' },
      populate: {
        opened_by: { fields: ['id', 'username', 'fullname'] },
        closed_by: { fields: ['id', 'username', 'fullname'] },
      },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: sesiones };
  },

  async movimiento(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const user = ctx.state.user;
    const body = ctx.request.body?.data || ctx.request.body || {};
    const { type, amount, concept, category, payment_method = 'efectivo', notes } = body;

    if (!type || !['ingreso', 'egreso'].includes(type)) {
      return ctx.badRequest('type debe ser "ingreso" o "egreso"');
    }
    if (!amount || Number(amount) <= 0) {
      return ctx.badRequest('amount debe ser mayor a 0');
    }
    if (!concept) return ctx.badRequest('concept es requerido');
    if (!category) return ctx.badRequest('category es requerido');

    const caja = await getOpenCaja(strapi, restauranteId);
    if (!caja) {
      return ctx.badRequest('No hay caja abierta. Abrí una caja primero.');
    }

    const mov = await strapi.entityService.create('api::movimiento-caja.movimiento-caja', {
      data: {
        type,
        amount: Number(amount),
        concept,
        category,
        payment_method,
        timestamp: new Date().toISOString(),
        notes: notes || null,
        caja_sesion: caja.id,
        created_by_user: user?.id || null,
      },
    });

    ctx.body = { data: mov };
  },

  async movimientos(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const { caja_sesion_id, type, desde, hasta, page = 1, pageSize = 50 } = ctx.request.query || {};

    const filters: any = {};

    if (caja_sesion_id) {
      filters.caja_sesion = caja_sesion_id;
    } else {
      // Filtrar movimientos por sesiones de caja del restaurante (no pasar { restaurante: id } plano sobre la relación)
      filters.caja_sesion = { restaurante: { id: restauranteId } };
    }

    if (type) filters.type = type;
    if (desde || hasta) {
      filters.timestamp = {};
      if (desde) filters.timestamp.$gte = desde;
      if (hasta) filters.timestamp.$lte = hasta;
    }

    const movimientos = await strapi.entityService.findMany('api::movimiento-caja.movimiento-caja', {
      filters,
      sort: { timestamp: 'desc' },
      populate: {
        pedido: { fields: ['id', 'total', 'order_status'] },
        created_by_user: { fields: ['id', 'username', 'fullname'] },
        caja_sesion: { fields: ['id', 'status', 'opened_at'] },
      },
      start: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
    });

    ctx.body = { data: movimientos };
  },

  async resumen(ctx: any) {
    const strapi: any = ctx.strapi;
    const restauranteId = ctx.state.restauranteId;
    const { desde, hasta } = ctx.request.query || {};

    const filters: any = { caja_sesion: { restaurante: { id: restauranteId } } };
    if (desde || hasta) {
      filters.timestamp = {};
      if (desde) filters.timestamp.$gte = desde;
      if (hasta) filters.timestamp.$lte = hasta;
    }

    const movimientos = await strapi.entityService.findMany('api::movimiento-caja.movimiento-caja', {
      filters,
      fields: ['type', 'amount', 'category', 'payment_method'],
      limit: 100000,
    });

    let totalIngresos = 0;
    let totalEgresos = 0;
    const byCategory: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};

    for (const m of movimientos) {
      const amt = Number(m.amount) || 0;
      if (m.type === 'ingreso') totalIngresos += amt;
      else totalEgresos += amt;

      const catKey = `${m.type}:${m.category}`;
      byCategory[catKey] = (byCategory[catKey] || 0) + amt;
      byPaymentMethod[m.payment_method] = (byPaymentMethod[m.payment_method] || 0) + amt;
    }

    ctx.body = {
      data: {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance: totalIngresos - totalEgresos,
        movimientos_count: movimientos.length,
        by_category: byCategory,
        by_payment_method: byPaymentMethod,
      },
    };
  },
};
