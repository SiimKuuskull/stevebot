import { dbConfig } from './src/database/db.ts';

export default { ...dbConfig, migrations: { directory: 'src/database/migrations' } };
