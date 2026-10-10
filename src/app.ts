import { startDiscordBot } from './services/discord/client.ts';
import { runDatabaseMigrations } from './database/db.ts';
import { startTriggers } from './services/discord/triggers/index.ts';

startDiscordBot();
runDatabaseMigrations();
startTriggers();
