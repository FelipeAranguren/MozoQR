/**
 * Add persistent state fields to mesas (SQLite-friendly).
 *
 * - mesas.active_session_code (string, nullable)
 * - mesas.occupied_at (datetime, nullable)
 *
 * Note: We intentionally do NOT delete tables or sessions in migrations.
 */

/* eslint-disable no-unused-vars */

module.exports = {
  async up(knex) {
    const hasMesas = await knex.schema.hasTable('mesas');
    if (!hasMesas) return;

    const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
    const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');

    if (!hasActiveSessionCode || !hasOccupiedAt) {
      await knex.schema.alterTable('mesas', (table) => {
        if (!hasActiveSessionCode) table.string('active_session_code');
        if (!hasOccupiedAt) table.dateTime('occupied_at');
      });
    }
  },

  async down(knex) {
    const hasMesas = await knex.schema.hasTable('mesas');
    if (!hasMesas) return;

    const hasActiveSessionCode = await knex.schema.hasColumn('mesas', 'active_session_code');
    const hasOccupiedAt = await knex.schema.hasColumn('mesas', 'occupied_at');

    // SQLite can't drop columns in older versions; Strapi environments vary.
    // We do a best-effort drop when supported; otherwise leave as-is.
    try {
      await knex.schema.alterTable('mesas', (table) => {
        if (hasActiveSessionCode) table.dropColumn('active_session_code');
        if (hasOccupiedAt) table.dropColumn('occupied_at');
      });
    } catch (e) {
      // no-op (best effort)
    }
  },
};


