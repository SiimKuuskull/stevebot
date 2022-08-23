import { knex } from 'knex';
import { config as envConfig } from 'dotenv';
import { log } from '../tools/logger';
import knexStringcase from 'knex-stringcase';

envConfig({ path: '.env.config' });
export const dbConfig = {
    client: 'postgresql',
    connection: {
        database: 'stevebot',
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
    },
    pool: {
        min: 2,
        max: 10,
    },
    migrations: {
        directory: 'dist/database/migrations/',
    },
};

export const db = knex(
    knexStringcase({
        ...dbConfig,
        recursiveStringCase: (value, name) => typeof value === 'object' && name === 'root.rows',
    }),
);

export async function runDatabaseMigrations() {
    log('Running migrations');
    try {
        await db.migrate.latest();
    } catch (error) {
        await db.raw('DROP TABLE IF EXISTS steve_games');
        await db.raw('DROP TABLE IF EXISTS balance');
        await db.raw('DROP TABLE IF EXISTS knex_migrations');
        await db.raw('DROP TABLE IF EXISTS knex_migrations_lock');
        await db.migrate.latest();
    }
}
