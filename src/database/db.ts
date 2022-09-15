import { knex } from 'knex';
import { config as envConfig } from 'dotenv';
import { log } from '../tools/logger';
import knexStringcase from 'knex-stringcase';
import { createProGamers } from '../services/player.service';

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
        if (process.env.RECREATE_DB === 'true') {
            await dropEverything();
        }
        await db.migrate.latest();
    } catch (error) {
        await dropEverything();
        await db.migrate.latest();
    }
    if (process.env.RECREATE_DB === 'true') {
        await createProGamers();
    }
}

async function dropEverything() {
    await db.raw('DROP TABLE IF EXISTS steve_games');
    await db.raw('DROP TABLE IF EXISTS balance');
    await db.raw('DROP TABLE IF EXISTS bets');
    await db.raw('DROP TABLE IF EXISTS player');
    await db.raw('DROP TABLE IF EXISTS knex_migrations');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock');
}
