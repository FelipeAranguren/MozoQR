import path from 'path';

export default ({ env }) => ({
  connection: {
    client: env('DATABASE_CLIENT', 'sqlite'),
    connection: {
      filename: env('DATABASE_FILENAME', path.join(__dirname, '..', '..', '.tmp', 'data.db')),
    },
    useNullAsDefault: true,
  },
});
