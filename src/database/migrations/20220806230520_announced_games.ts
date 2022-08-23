import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.bigint('game_id').notNullable().defaultTo(0);
        table.string('game_status').notNullable().defaultTo('IN PROGRESS');
        table.integer('game_length').notNullable().defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('balance', (table) => {
        table.string('user_id').primary();
        table.timestamps(false, true);
        table.float('amount').notNullable().defaultTo(0);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('steve_games');
    await knex.schema.dropTable('balance');
}
