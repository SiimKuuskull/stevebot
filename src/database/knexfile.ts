export default {
    development: {
        client: 'postgresql',
        connection: {
            database: 'stevebot',
            user: 'postgres',
            password: 'Teemant123?',
        },
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: 'dist/database/migrations/',
        },
    },
};
