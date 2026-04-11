/**
 * Campos para configuración MODO PCT / transferencia en perfil de restaurante.
 */

/* eslint-disable no-unused-vars */

module.exports = {
  async up(knex) {
    const hasTable = await knex.schema.hasTable('restaurantes');
    if (!hasTable) return;

    const cols = ['modo_store_id', 'modo_terminal_id', 'pct_merchant_cbu_alias'];
    const missing = [];
    for (const c of cols) {
      if (!(await knex.schema.hasColumn('restaurantes', c))) missing.push(c);
    }
    if (missing.length === 0) return;

    await knex.schema.alterTable('restaurantes', (table) => {
      if (missing.includes('modo_store_id')) table.string('modo_store_id');
      if (missing.includes('modo_terminal_id')) table.string('modo_terminal_id');
      if (missing.includes('pct_merchant_cbu_alias')) table.string('pct_merchant_cbu_alias');
    });
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('restaurantes');
    if (!hasTable) return;
    try {
      await knex.schema.alterTable('restaurantes', (table) => {
        table.dropColumn('modo_store_id');
        table.dropColumn('modo_terminal_id');
        table.dropColumn('pct_merchant_cbu_alias');
      });
    } catch (_e) {
      /* SQLite / entornos sin drop column */
    }
  },
};
