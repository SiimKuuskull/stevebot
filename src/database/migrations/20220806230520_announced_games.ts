exports.up = function (knex) {
    return knex.schema.createTable('steve_games', function (table) {
        table.increments('id');
        table.bigint('gameid').notNullable().defaultTo('1');
        table.string('game_status').notNullable().defaultTo('2');
        table.integer('game_length').notNullable().defaultTo('3');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('steve_games');
};
