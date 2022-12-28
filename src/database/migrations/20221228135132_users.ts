import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users', (table) => {
        table.string('id').unique().primary();
        table.timestamps(false, true);
        table.string('name').notNullable();
        table.string('summoner_name');
        table.string('summoner_id');
    });
    await knex.schema.createTable('game_meta', (table) => {
        table.increments();
        table.timestamps(false, true);
        table.jsonb('meta').notNullable();
        table.integer('steve_game_id').references('id').inTable('steve_games').onDelete('cascade');

        table.index('steve_game_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('users');
}
