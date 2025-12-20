"use strict";
// import type { Core } from '@strapi/strapi';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register( /* { strapi }: { strapi: Core.Strapi } */) { },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    async bootstrap({ strapi } /*: { strapi: Core.Strapi } */) {
        var _a, _b, _c, _d, _e, _f, _g;
        // Auto-migration (safe): ensure new mesa state columns exist.
        // This prevents runtime 500s when DB schema is older than the content-type.
        try {
            const knex = (_a = strapi === null || strapi === void 0 ? void 0 : strapi.db) === null || _a === void 0 ? void 0 : _a.connection;
            if (!(knex === null || knex === void 0 ? void 0 : knex.schema))
                return;
            const hasMesas = await knex.schema.hasTable('mesas');
            if (!hasMesas)
                return;
            const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
            const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');
            if (!hasActiveSessionCode || !hasOccupiedAt) {
                await knex.schema.alterTable('mesas', (table) => {
                    if (!hasActiveSessionCode)
                        table.string('active_session_code');
                    if (!hasOccupiedAt)
                        table.dateTime('occupied_at');
                });
                (_c = (_b = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _b === void 0 ? void 0 : _b.info) === null || _c === void 0 ? void 0 : _c.call(_b, '[bootstrap] ✅ Added missing columns to mesas: active_session_code / occupied_at');
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
                        (_e = (_d = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _d === void 0 ? void 0 : _d.info) === null || _e === void 0 ? void 0 : _e.call(_d, `[bootstrap] ✅ Normalized ghost occupied mesas: ${res}`);
                    }
                }
                catch (e) {
                    // best-effort
                }
            }
        }
        catch (err) {
            // Do not crash boot; log and continue (app can still run with legacy behavior).
            (_g = (_f = strapi === null || strapi === void 0 ? void 0 : strapi.log) === null || _f === void 0 ? void 0 : _f.warn) === null || _g === void 0 ? void 0 : _g.call(_f, '[bootstrap] ⚠️ Could not auto-migrate mesas columns: ' + ((err === null || err === void 0 ? void 0 : err.message) || err));
        }
    },
};
