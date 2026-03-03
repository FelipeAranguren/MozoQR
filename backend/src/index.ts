import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Asegurar que Koa confíe en los headers del proxy (Railway) para cookies seguras
    if (strapi?.server?.app) {
      strapi.server.app.proxy = true;
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi } /*: { strapi: Core.Strapi } */) {
    // Auto-migration (safe): ensure new mesa state columns exist.
    // This prevents runtime 500s when DB schema is older than the content-type.
    try {
      const knex = strapi?.db?.connection;
      if (!knex?.schema) return;

      const hasMesas = await knex.schema.hasTable('mesas');
      if (!hasMesas) return;

      const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
      const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');

      if (!hasActiveSessionCode || !hasOccupiedAt) {
        await knex.schema.alterTable('mesas', (table: any) => {
          if (!hasActiveSessionCode) table.string('active_session_code');
          if (!hasOccupiedAt) table.dateTime('occupied_at');
        });
        strapi?.log?.info?.('[bootstrap] ✅ Added missing columns to mesas: active_session_code / occupied_at');
      }

      // Normalize legacy/contaminated data:
      // If a table is marked 'ocupada' but has no active session code, it's a "ghost occupied" state.
      // We safely reset it to 'disponible' (no destructive deletes).
      if (await knex.schema.hasColumn('mesas', 'active_session_code')) {
        try {
          const res = await knex('mesas')
            .where({ status: 'ocupada' })
            .whereNull('active_session_code')
            .update({
              status: 'disponible',
              occupied_at: null,
              published_at: knex.fn.now(),
            });
          if (res) {
            strapi?.log?.info?.(`[bootstrap] ✅ Normalized ghost occupied mesas: ${res}`);
          }
        } catch (e) {
          // best-effort
        }
      }

      // Auto-migration: ensure mesa_sesions has foreign key columns for relations
      const hasMesaSesions = await knex.schema.hasTable('mesa_sesions');
      if (hasMesaSesions) {
        const hasMesaId = await knex.schema.hasColumn('mesa_sesions', 'mesa_id');
        const hasRestauranteId = await knex.schema.hasColumn('mesa_sesions', 'restaurante_id');

        if (!hasMesaId || !hasRestauranteId) {
          try {
            await knex.schema.alterTable('mesa_sesions', (table: any) => {
              if (!hasMesaId) {
                table.integer('mesa_id').nullable();
                strapi?.log?.info?.('[bootstrap] ✅ Added mesa_id column to mesa_sesions');
              }
              if (!hasRestauranteId) {
                table.integer('restaurante_id').nullable();
                strapi?.log?.info?.('[bootstrap] ✅ Added restaurante_id column to mesa_sesions');
              }
            });
            strapi?.log?.info?.('[bootstrap] ✅ Successfully added foreign key columns to mesa_sesions');
          } catch (migrationErr: any) {
            strapi?.log?.warn?.('[bootstrap] ⚠️ Could not add foreign key columns to mesa_sesions: ' + (migrationErr?.message || migrationErr));
          }
        }
      }
    } catch (err: any) {
      // Do not crash boot; log and continue (app can still run with legacy behavior).
      strapi?.log?.warn?.('[bootstrap] ⚠️ Could not auto-migrate columns: ' + (err?.message || err));
    }

    // Cron: cerrar sesiones de mesa abiertas sin pedidos (mesa → disponible)
    const CLEANUP_INTERVAL_MS = Math.max(60_000, Number(process.env.CLEANUP_EMPTY_SESSION_INTERVAL_MS) || 2 * 60 * 1000); // default 2 min
    const { runCloseEmptyTableSessions } = await import('./cron/close-empty-table-sessions');
    setTimeout(() => {
      runCloseEmptyTableSessions(strapi)
        .then(({ closed, errors }) => {
          if (closed > 0 || errors > 0) {
            strapi?.log?.info?.(`[bootstrap] Cron close-empty-sessions: closed=${closed}, errors=${errors}`);
          }
        })
        .catch((e) => strapi?.log?.warn?.('[bootstrap] Cron close-empty-sessions error:', e?.message || e));
    }, 15_000); // Primera ejecución a los 15 s
    setInterval(() => {
      runCloseEmptyTableSessions(strapi)
        .then(({ closed, errors }) => {
          if (closed > 0 || errors > 0) {
            strapi?.log?.info?.(`[cron] close-empty-sessions: closed=${closed}, errors=${errors}`);
          }
        })
        .catch((e) => strapi?.log?.warn?.('[cron] close-empty-sessions error:', e?.message || e));
    }, CLEANUP_INTERVAL_MS);
    strapi?.log?.info?.(`[bootstrap] ✅ Cron close-empty-sessions programado cada ${CLEANUP_INTERVAL_MS / 1000}s`);
  },
};
