import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('player', (table) => {
        table.unique(['puuid']);
    });
    await knex.schema.alterTable('steve_games', (table) => {
        table.integer('player_id').references('id').inTable('player').onDelete('RESTRICT');
        table.index('player_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('steve_games', (table) => {
        table.dropColumn('player_id');
    });
    await knex.schema.alterTable('player', (table) => {
        table.dropUnique(['puuid']);
    });
}
