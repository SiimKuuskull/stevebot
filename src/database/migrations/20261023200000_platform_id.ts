import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    for (const tableName of ['player', 'steve_games']) {
        await knex.schema.alterTable(tableName, (table) => {
            table.string('platform_id').notNullable().defaultTo('EUN1');
        });
        await knex.raw(`ALTER TABLE ${tableName} ALTER COLUMN platform_id DROP DEFAULT`);
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('player', (table) => {
        table.dropColumn('platform_id');
    });
    await knex.schema.alterTable('steve_games', (table) => {
        table.dropColumn('platform_id');
    });
}
