import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.bigint('game_id').notNullable().defaultTo(0);
        table.string('game_status').notNullable().defaultTo('IN PROGRESS');
        table.integer('game_length').notNullable().defaultTo(0);
        table.boolean('game_result');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('balance', (table) => {
        table.string('user_id').primary();
        table.string('user_name').notNullable();
        table.timestamps(false, true);
        table.float('amount').notNullable().defaultTo(0);
    });

    await knex.schema.createTable('bets', (table) => {
        table.string('user_id').primary();
        table.string('user_name').notNullable();
        table.float('amount').notNullable().defaultTo(0);
        table.bigint('game_id').notNullable().defaultTo(0);
        table.boolean('guess').notNullable().defaultTo(false);
        table.boolean('result').notNullable().defaultTo(false);
        table.timestamps(false, true);
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
}
