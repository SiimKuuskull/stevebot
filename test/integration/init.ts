/* eslint-disable @typescript-eslint/no-require-imports */
import { map } from 'bluebird';
import { knex, Knex } from 'knex';
import { snakeCase } from 'lodash';
import knexStringcase from 'knex-stringcase';
import nock from 'nock';
import sinon, { SinonSandbox } from 'sinon';
import { dbConfig } from '../../src/database/db';
import { disableLogs } from '../../src/tools/logger';

disableLogs();
export let sandbox: SinonSandbox;
export let testDb: Knex;

const databases: string[] = [];
let knexForSetup: Knex | undefined;

export const testDbConfig = knexStringcase({
    ...dbConfig,
    migrations: {
        directory: './src/database/migrations',
    },
    recursiveStringCase: (value, name) => typeof value === 'object' && name === 'root.rows',
});

before(async () => {
    await databaseBeforeAllTests(testDbConfig);
});

beforeEach(async function () {
    sandbox = sinon.createSandbox();
    ({ knex: testDb } = await databaseBeforeEachTest(this.currentTest.title, testDbConfig));
    await switchConnection();
});

afterEach(async function () {
    sandbox.restore();
    await databaseAfterEachTest(this.currentTest.title, testDb);
    const activeMocks = nock.activeMocks();
    if (activeMocks.length) {
        this.test?.emit('error', new Error(`Not all nocks were used: ${activeMocks}`));
        nock.cleanAll();
    }
});

after(async () => {
    await databaseAfterAllTests();
});

async function databaseAfterAllTests() {
    await map(databases, dropTemplateDatabase, { concurrency: 1 });
    await knexForSetup?.destroy();
    knexForSetup = undefined;
}

async function databaseAfterEachTest(testName: string, testDb) {
    const dbName = testDb.client.database();
    await testDb.destroy();
    await knexForSetup?.raw(`DROP DATABASE IF EXISTS ${dbName}`);
}

async function databaseBeforeAllTests(dbConfig) {
    const knexConfig = { ...dbConfig };
    if (!knexForSetup) {
        knexForSetup = knex(replaceDatabase(knexConfig, 'postgres'));
    }
    try {
        await createTemplateDatabase(replaceDatabase(knexConfig, 'stevebot'));
    } catch (error) {
        if (error.message === `getaddrinfo EAI_AGAIN ${knexConfig.connection.database}-db`) {
            throw new Error(
                `Failed to connect to ${knexConfig.connection.database}-db. Perhaps you are missing .env.test file?`,
            );
        } else if (error.message === 'connect ECONNREFUSED 127.0.0.1:5432') {
            throw new Error('Failed to connect to localhost, is your postgres docker image running?');
        }
        throw error;
    }
}

async function databaseBeforeEachTest(testName: string, dbConfig) {
    return createTestDatabaseFromTemplate(testName, dbConfig);
}

async function createTemplateDatabase(knexConfig) {
    const templateDbName = getTemplateDbName(knexConfig);
    await dropTemplateDatabase(templateDbName);
    await knexForSetup?.raw(`CREATE DATABASE ${templateDbName}`);
    await knexForSetup?.raw(`UPDATE pg_database SET datistemplate='true' WHERE datname='${templateDbName}'`);
    databases.push(templateDbName);
    const db = knex(replaceDatabase(knexConfig, templateDbName));
    await db.migrate.latest();
    if (knexConfig.seeds) {
        await db.seed.run();
    }
    await db.destroy();
}

async function createTestDatabaseFromTemplate(testName: string, knexConfig) {
    const templateDbName = getTemplateDbName(knexConfig);
    const dbName = getDbName(knexConfig.connection.database, testName);
    await knexForSetup?.raw(`DROP DATABASE IF EXISTS ${dbName}`);
    await knexForSetup?.raw(`CREATE DATABASE ${dbName} TEMPLATE ${templateDbName}`);
    await knexForSetup?.raw(`ALTER DATABASE ${dbName} SET log_statement = "all"`);
    return { knex: knex(replaceDatabase(knexConfig, dbName)) };
}

async function dropTemplateDatabase(templateDbName: string) {
    await knexForSetup?.raw(`UPDATE pg_database SET datistemplate='false' WHERE datname='${templateDbName}'`);
    await knexForSetup?.raw(`DROP DATABASE IF EXISTS ${templateDbName}`);
}

function getTemplateDbName(knexConfig) {
    const { database } = knexConfig.connection;
    return getDbName(database, 'template');
}

function getDbName(database: string, testName: string) {
    const testNameSnakeCase = snakeCase(testName);
    return `${database}_test_${testNameSnakeCase}`.substring(0, 63);
}

function replaceDatabase(knexConfig, database: string) {
    return {
        ...knexConfig,
        connection: { ...knexConfig.connection, database },
    };
}

async function switchConnection() {
    await require('../../src/database/db').db.destroy();
    require('../../src/database/db').db = testDb;
}
