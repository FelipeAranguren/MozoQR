/**
 * Create payment_notifications table for realtime "paid tables" notifications.
 *
 * We keep it DB-level (not a Strapi Content Type) because:
 * - it's append-only / lightweight
 * - we only need last 3 per restaurante
 * - it avoids admin UI / permissions overhead
 */
/* eslint-disable no-unused-vars */

async function hasTable(knex, table) {
  try {
    return await knex.schema.hasTable(table);
  } catch (_e) {
    return false;
  }
}

module.exports = {
  async up(knex) {
    const table = 'payment_notifications';
    const exists = await hasTable(knex, table);
    if (exists) return;

    await knex.schema.createTable(table, (t) => {
      t.increments('id').primary();
      t.integer('restaurante_id').notNullable().index();
      t.integer('mesa_number').notNullable().index();
      t.decimal('amount', 14, 2).nullable();
      t.string('currency', 8).nullable();
      t.timestamp('paid_at', { useTz: true }).notNullable().index();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });

    // Fast lookup for "last 3 per restaurant"
    try {
      await knex.raw(
        `CREATE INDEX IF NOT EXISTS "payment_notifications_rest_paid_idx" ON "payment_notifications" ("restaurante_id", "paid_at" DESC)`
      );
    } catch (_e) {
      // ignore (sqlite syntax differences)
    }
  },

  async down(knex) {
    const table = 'payment_notifications';
    const exists = await hasTable(knex, table);
    if (!exists) return;
    await knex.schema.dropTable(table);
  },
};

