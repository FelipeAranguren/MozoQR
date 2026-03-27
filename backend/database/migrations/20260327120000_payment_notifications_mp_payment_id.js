/* eslint-disable no-unused-vars */

async function hasColumn(knex, table, column) {
  try {
    return await knex.schema.hasColumn(table, column);
  } catch (_e) {
    return false;
  }
}

module.exports = {
  async up(knex) {
    const table = 'payment_notifications';
    const exists = await knex.schema.hasTable(table);
    if (!exists) return;

    const has = await hasColumn(knex, table, 'mp_payment_id');
    if (has) return;

    await knex.schema.alterTable(table, (t) => {
      t.string('mp_payment_id', 64).nullable();
    });

    try {
      await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "payment_notifications_mp_payment_id_unique" ON "payment_notifications" ("mp_payment_id") WHERE "mp_payment_id" IS NOT NULL`);
    } catch (_e) {
      // SQLite partial unique may differ; best-effort
    }
  },

  async down(knex) {
    const table = 'payment_notifications';
    const exists = await knex.schema.hasTable(table);
    if (!exists) return;

    try {
      await knex.raw(`DROP INDEX IF EXISTS "payment_notifications_mp_payment_id_unique"`);
    } catch (_e) {
      /* ignore */
    }

    const has = await hasColumn(knex, table, 'mp_payment_id');
    if (has) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn('mp_payment_id');
      });
    }
  },
};
