import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.string('gameid').notNullable().defaultTo('1');
        table.string('game_status').notNullable().defaultTo('2');
        table.string('game_length').notNullable().defaultTo('3');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('steve_games');
}
