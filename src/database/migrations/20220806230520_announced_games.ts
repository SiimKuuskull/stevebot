import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.bigint('game_id').notNullable().defaultTo(0);
        table.string('game_status').notNullable().defaultTo('IN PROGRESS');
        table.integer('game_length').notNullable().defaultTo(0);
        table.boolean('game_result').notNullable().defaultTo('UNDECIDED');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('balance', (table) => {
        table.string('user_id').primary();
        table.timestamps(false, true);
        table.float('amount').notNullable().defaultTo(0);
    });

    await knex.schema.createTable('bets', (table) => {
        table.string('user_id').primary();
        table.float('amount').notNullable().defaultTo(0);
        table.bigint('game_id').notNullable().defaultTo(0);
        table.boolean('guess').notNullable().defaultTo('NO BET');
        table.boolean('result').notNullable().defaultTo('NO RESULT');
        table.timestamps(false, true);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('steve_games');
    await knex.schema.dropTable('balance');
    await knex.schema.dropTable('bets');
}
