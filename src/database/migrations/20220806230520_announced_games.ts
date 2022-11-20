import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.bigint('game_id').notNullable().defaultTo(0).unique();
        table.string('game_status').notNullable().defaultTo('IN PROGRESS');
        table.float('game_start').notNullable().defaultTo(0);
        table.bigint('game_end').notNullable().defaultTo(0);
        table.boolean('game_result');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('balance', (table) => {
        table.increments('id');
        table.string('user_id').primary();
        table.string('user_name').notNullable();
        table.timestamps(false, true);
        table.float('amount').notNullable().defaultTo(0);
        table.float('penalty').notNullable().defaultTo(0);
        table.integer('bankruptcy').notNullable().defaultTo(0);
        table.timestamp('daily_coin');
    });

    await knex.schema.createTable('bets', (table) => {
        table.increments('id').primary();
        table.string('user_id').notNullable();
        table.float('amount').notNullable().defaultTo(0);
        table.float('odds').notNullable().defaultTo(2);
        table.bigint('game_id').notNullable().defaultTo(0);
        table.string('guess').notNullable().defaultTo('IN PROGRESS');
        table.string('result').notNullable().defaultTo('IN PROGRESS');
        table.float('game_start').notNullable().defaultTo(0);
        table.timestamps(false, true);
    });

    await knex.schema.createTable('loans', (table) => {
        table.increments('id').primary();
        table.string('user_id').notNullable();
        table.float('amount').notNullable().defaultTo(0);
        table.float('interest').notNullable().defaultTo(0.08);
        table.timestamps(false, true);
        table.timestamp('deadline').notNullable();
        table.string('payback').notNullable().defaultTo('UNRESOLVED');
    });

    await knex.schema.createTable('player', (table) => {
        table.string('id').primary().notNullable();
        table.timestamps(false, true);
        table.string('accountId').notNullable();
        table.string('name').notNullable();
        table.string('puuid').notNullable();
        table.boolean('is_tracked').notNullable().defaultTo(false);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('steve_games');
    await knex.schema.dropTable('balance');
    await knex.schema.dropTable('bets');
    await knex.schema.dropTable('player');
    await knex.schema.dropTable('loans');
}
