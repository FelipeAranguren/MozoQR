/**
 * Scope slug uniqueness by restaurante.
 *
 * Problem: Strapi UID fields create a global UNIQUE constraint (slug must be unique across all restaurants).
 * Fix: drop the global unique index/constraint on slug and create a composite UNIQUE(restaurante_id, slug)
 * for categorias and productos.
 */
/* eslint-disable no-unused-vars */

async function hasColumn(knex, table, column) {
  try {
    return await knex.schema.hasColumn(table, column);
  } catch (e) {
    return false;
  }
}

async function hasTable(knex, table) {
  try {
    return await knex.schema.hasTable(table);
  } catch (e) {
    return false;
  }
}

async function dropGlobalSlugUnique(knex, table) {
  // Strapi commonly names this {table}_slug_unique, but we do best-effort with raw SQL.
  const idx = `${table}_slug_unique`;

  try {
    await knex.raw(`DROP INDEX IF EXISTS "${idx}"`);
  } catch (e) {
    // ignore
  }

  // Postgres can also have it as a constraint.
  try {
    await knex.raw(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${idx}"`);
  } catch (e) {
    // ignore (SQLite doesn't support DROP CONSTRAINT)
  }

  // Fallback attempt via schema builder (may fail depending on constraint naming)
  try {
    await knex.schema.alterTable(table, (t) => {
      t.dropUnique(['slug']);
    });
  } catch (e) {
    // ignore
  }
}

async function createScopedSlugUnique(knex, table) {
  const compositeIdx = `${table}_restaurante_slug_unique`;

  // If restaurante_id column name differs, we should not create a broken index.
  const hasRestauranteId = await hasColumn(knex, table, 'restaurante_id');
  const hasSlug = await hasColumn(knex, table, 'slug');
  if (!hasRestauranteId || !hasSlug) return;

  // Ensure any previous attempt doesn't block creation
  try {
    await knex.raw(`DROP INDEX IF EXISTS "${compositeIdx}"`);
  } catch (e) {
    // ignore
  }

  // Create composite unique index (SQLite + Postgres compatible syntax)
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS "${compositeIdx}" ON "${table}" ("restaurante_id", "slug")`
  );
}

module.exports = {
  async up(knex) {
    for (const table of ['categorias', 'productos']) {
      const exists = await hasTable(knex, table);
      if (!exists) continue;

      await dropGlobalSlugUnique(knex, table);
      await createScopedSlugUnique(knex, table);
    }
  },

  async down(knex) {
    // Best effort rollback: remove composite unique index (keep data as-is).
    for (const table of ['categorias', 'productos']) {
      const exists = await hasTable(knex, table);
      if (!exists) continue;

      const compositeIdx = `${table}_restaurante_slug_unique`;
      try {
        await knex.raw(`DROP INDEX IF EXISTS "${compositeIdx}"`);
      } catch (e) {
        // ignore
      }
    }
  },
};

