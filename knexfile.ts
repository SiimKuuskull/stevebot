import { dbConfig } from './src/database/db';

export = { ...dbConfig, migrations: { directory: 'src/database/migrations' } };
