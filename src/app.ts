import { startDiscordBot } from './services/discord/client.ts';
import { runDatabaseMigrations } from './database/db.ts';
import { startTriggers } from './services/discord/triggers/index.ts';
import { log, LoggerType } from './tools/logger.ts';

async function start() {
    await runDatabaseMigrations();
    await startDiscordBot();
    startTriggers();
}

start().catch((error) => {
    log(error, LoggerType.ERROR);
    process.exit(1);
});
