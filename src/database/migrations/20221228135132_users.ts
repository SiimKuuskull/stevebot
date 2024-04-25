import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    async function onUpdateTrigger(tableName: string) {
        await knex.raw(`
            CREATE TRIGGER set_timestamp_${tableName}
            BEFORE UPDATE ON ${tableName}
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp_at();
        `);
    }
    await knex.schema.createTable('users', (table) => {
        table.string('id').unique().primary();
        table.timestamps(false, true);
        table.string('name').notNullable();
        table.string('game_name');
        table.string('tag_line');
        table.string('puuid');
    });
    await onUpdateTrigger('users');
    await knex.schema.createTable('game_meta', (table) => {
        table.increments();
        table.timestamps(false, true);
        table.jsonb('meta').notNullable();
        table.integer('steve_game_id').references('id').inTable('steve_games').onDelete('cascade');

        table.index('steve_game_id');
    });
    await onUpdateTrigger('game_meta');
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('users');
    await knex.schema.dropTable('game_meta');
}
