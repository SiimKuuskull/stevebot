import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
        CREATE OR REPLACE FUNCTION trigger_set_timestamp_at() RETURNS TRIGGER AS $BODY$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $BODY$ LANGUAGE plpgsql;
    `);
    async function onUpdateTrigger(tableName: string) {
        await knex.raw(`
            CREATE TRIGGER set_timestamp_${tableName}
            BEFORE UPDATE ON ${tableName}
            FOR EACH ROW
            EXECUTE PROCEDURE trigger_set_timestamp_at();
        `);
    }
    await knex.schema.createTable('transactions', (table) => {
        table.increments();
        table.timestamps(false, true);
        table.float('amount').notNullable();
        table.float('balance').notNullable();
        table.string('type').notNullable();
        table.string('user_id').notNullable();
        table.integer('external_transaction_id').notNullable();

        table.index('created_at');
        table.index('user_id');
        table.index('type');
    });
    await onUpdateTrigger('transactions');

    await knex.schema.createTable('daily_coin', (table) => {
        table.increments();
        table.timestamps(false, true);
        table.string('user_id').notNullable();
        table.integer('transaction_id').references('id').inTable('transactions').onDelete('cascade');

        table.index('created_at');
    });

    await onUpdateTrigger('daily_coin');
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable('daily_coin');
    await knex.schema.dropTable('transactions');
}
