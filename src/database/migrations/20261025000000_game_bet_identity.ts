import { type Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('bets', (table) => {
        table.integer('steve_game_id');
    });
    await knex.raw(`
        UPDATE bets AS b SET steve_game_id = g.id
        FROM steve_games AS g WHERE b.game_id = g.game_id
    `);
    const unmatched = await knex('bets').whereNull('steve_game_id').select('id').orderBy('id').limit(10);
    if (unmatched.length) {
        throw new Error(
            `Cannot migrate bets without matching games. Example bet IDs: ${unmatched.map((bet) => bet.id).join(', ')}`,
        );
    }
    await knex.schema.alterTable('bets', (table) => {
        table.integer('steve_game_id').notNullable().alter();
        table.foreign('steve_game_id').references('id').inTable('steve_games').onDelete('RESTRICT');
        table.index('steve_game_id');
        table.dropColumn('game_id');
    });
    await knex.schema.alterTable('steve_games', (table) => {
        table.dropUnique(['game_id']);
        table.unique(['platform_id', 'game_id', 'player_id']);
    });
}

export async function down(knex: Knex): Promise<void> {
    const duplicates = await knex('steve_games').select('game_id').groupBy('game_id').havingRaw('COUNT(*) > 1').first();
    if (duplicates) {
        throw new Error('Cannot roll back game identity: multiple games share a Riot game ID. No data was removed.');
    }
    await knex.schema.alterTable('bets', (table) => {
        table.bigint('game_id').notNullable().defaultTo(0);
    });
    await knex.raw(`
        UPDATE bets AS b SET game_id = g.game_id
        FROM steve_games AS g WHERE b.steve_game_id = g.id
    `);
    await knex.schema.alterTable('bets', (table) => {
        table.dropColumn('steve_game_id');
    });
    await knex.schema.alterTable('steve_games', (table) => {
        table.dropUnique(['platform_id', 'game_id', 'player_id']);
        table.unique(['game_id']);
    });
}
