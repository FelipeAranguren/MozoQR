/**
 * Cron job: cierra sesiones de mesa (mesa-sesion) que llevan abiertas más de X minutos
 * y no tienen ningún pedido asociado (o solo cancelados). Libera la mesa a 'disponible'.
 *
 * Evita que queden mesas "ocupadas" cuando el cliente abrió sesión pero se fue sin pedir,
 * y reduce 404 al buscar pedidos de sesiones fantasma.
 *
 * Configuración (env):
 * - CLEANUP_EMPTY_SESSION_AGE_MINUTES: antigüedad mínima en minutos para considerar sesión abandonada (default: 15)
 * - CLEANUP_EMPTY_SESSION_INTERVAL_MS: intervalo entre ejecuciones del cron en ms (default: 120000 = 2 min). Se configura en bootstrap.
 */

const DEFAULT_AGE_MINUTES = 15;

/**
 * Ejecuta una pasada del job: cierra sesiones abiertas sin pedidos y libera las mesas.
 * @param strapiInstance - Instancia de Strapi (pasada desde bootstrap)
 */
export async function runCloseEmptyTableSessions(strapiInstance: any): Promise<{ closed: number; errors: number }> {
  if (!strapiInstance?.db?.query) {
    return { closed: 0, errors: 0 };
  }

  const ageMinutes = Math.max(1, Number(process.env.CLEANUP_EMPTY_SESSION_AGE_MINUTES) || DEFAULT_AGE_MINUTES);
  const threshold = new Date(Date.now() - ageMinutes * 60 * 1000);

  let closed = 0;
  let errors = 0;

  try {
    const openSessions = await strapiInstance.db.query('api::mesa-sesion.mesa-sesion').findMany({
      where: { session_status: 'open' },
      select: ['id', 'mesa', 'code', 'openedAt', 'createdAt'],
    });

    if (!Array.isArray(openSessions) || openSessions.length === 0) {
      return { closed: 0, errors: 0 };
    }

    const knex = strapiInstance.db?.connection;
    const hasOccupiedAt = knex?.schema ? await knex.schema.hasColumn('mesas', 'occupied_at').catch(() => false) : false;

    for (const session of openSessions) {
      try {
        const openedAt = session.openedAt ?? session.opened_at ?? session.createdAt ?? session.created_at;
        if (openedAt && new Date(openedAt) > threshold) {
          continue; // Sesión reciente, no tocar
        }

        const orderCount = await strapiInstance.db.query('api::pedido.pedido').count({
          where: {
            mesa_sesion: session.id,
            order_status: { $ne: 'cancelled' },
          },
        });

        if (orderCount > 0) {
          continue; // Tiene pedidos (pending, preparing, served o paid), no cerrar
        }

        await strapiInstance.db.query('api::mesa-sesion.mesa-sesion').update({
          where: { id: session.id },
          data: {
            session_status: 'closed',
            closedAt: new Date(),
            publishedAt: new Date(),
          },
        });

        const mesaId = session.mesa?.id ?? session.mesa ?? session.mesa_id;
        if (mesaId) {
          const updateData: Record<string, any> = {
            status: 'disponible',
            activeSessionCode: null,
            publishedAt: new Date(),
          };
          if (hasOccupiedAt) {
            updateData.occupiedAt = null;
          }
          await strapiInstance.db.query('api::mesa.mesa').update({
            where: { id: mesaId },
            data: updateData,
          });
        }

        closed++;
        strapiInstance.log?.info?.(`[cron] Sesión vacía cerrada: mesa_sesion id=${session.id}, mesa id=${mesaId}`);
      } catch (err: any) {
        errors++;
        strapiInstance.log?.warn?.(`[cron] Error cerrando sesión ${session?.id}:`, err?.message || err);
      }
    }
  } catch (err: any) {
    strapiInstance?.log?.warn?.('[cron] Error en runCloseEmptyTableSessions:', err?.message || err);
  }

  return { closed, errors };
}
