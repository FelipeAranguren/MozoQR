import path from 'path';

/**
 * Base de datos: si DATABASE_URL está definida (Railway, etc.) se usa PostgreSQL.
 * Si no, se usa SQLite para desarrollo local.
 */
export default ({ env }: { env: (key: string, fallback?: string) => string }) => {
  const databaseUrl = (env('DATABASE_URL') || '').trim();

  if (databaseUrl) {
    // Producción: PostgreSQL con DATABASE_URL (Railway inyecta esta variable).
    // connectionString anula host/port/database/user/password.
    const ssl =
      databaseUrl.includes('sslmode=require') ||
      databaseUrl.includes('ssl=true') ||
      /\.railway\.app|\.amazonaws\.com|neon\.tech|supabase\.co/.test(databaseUrl)
        ? { rejectUnauthorized: false }
        : false;

    return {
      connection: {
        client: 'postgres',
        connection: {
          connectionString: databaseUrl,
          ssl,
          schema: env('DATABASE_SCHEMA', 'public'),
        },
        pool: {
          min: parseInt(env('DATABASE_POOL_MIN', '0'), 10),
          max: parseInt(env('DATABASE_POOL_MAX', '10'), 10),
        },
        acquireConnectionTimeout: parseInt(env('DATABASE_CONNECTION_TIMEOUT', '60000'), 10),
      },
    };
  }

  // Desarrollo local: SQLite
  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: env('DATABASE_FILENAME', path.join(__dirname, '..', '..', '.tmp', 'data.db')),
      },
      useNullAsDefault: true,
    },
  };
};
