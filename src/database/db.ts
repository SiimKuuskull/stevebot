/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import { knex } from 'knex';
import { config as envConfig } from 'dotenv';
import { log } from '../tools/logger';
import knexStringcase from 'knex-stringcase';
import { createProGamers } from '../services/player.service';
import { Balance } from './models/balance.model';
import { Transaction } from './models/transactions.model';
import { User } from './models/user.model';
import { DailyCoin } from './models/dailyCoin.model';
import { GameMeta } from './models/gameMeta.model';
import { Loan } from './models/loan.model';
import { Player } from './models/player.model';
import { SteveGame } from './models/steveGame.model';
import { Bet } from './models/bet.model';

envConfig({ path: '.env.config' });
export const dbConfig = {
    client: 'postgresql',
    connection: {
        database: 'stevebot',
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
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

declare module 'knex/types/tables' {
    interface Tables {
        balance: Balance;
        bets: Bet;
        daily_coin: DailyCoin;
        game_meta: GameMeta;
        loans: Loan;
        player: Player;
        steve_games: SteveGame;
        transactions: Transaction;
        users: User;
    }
}

export async function runDatabaseMigrations() {
    await createDatabase();
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
    await createProGamers();
}

async function createDatabase() {
    const pgPromise = require('pg-promise');
    const connectionString = `postgres://${dbConfig.connection.user}:${dbConfig.connection.password}@localhost:5432/postgres`;
    const systemDbClient = pgPromise()(connectionString);
    try {
        await systemDbClient.any(`CREATE DATABASE ${dbConfig.connection.database}`);
        log(`Database ${dbConfig.connection.database} created successfully`);
    } catch (error) {
        if (error.code !== '42P04') {
            throw error;
        }
    } finally {
        systemDbClient.$pool.end();
    }
}

async function dropEverything() {
    await db.raw('DROP TABLE IF EXISTS balance');
    await db.raw('DROP TABLE IF EXISTS bets');
    await db.raw('DROP TABLE IF EXISTS player');
    await db.raw('DROP TABLE IF EXISTS loans');
    await db.raw('DROP TABLE IF EXISTS daily_coin');
    await db.raw('DROP TABLE IF EXISTS game_meta');
    await db.raw('DROP TABLE IF EXISTS users');
    await db.raw('DROP TABLE IF EXISTS steve_games');
    await db.raw('DROP TABLE IF EXISTS transactions');
    await db.raw('DROP TABLE IF EXISTS knex_migrations');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock');
}
