import { startDiscordBot } from './services/discord/client';
import { runDatabaseMigrations } from './database/db';
import { startTriggers } from './services/discord/triggers';

startDiscordBot();
runDatabaseMigrations();
startTriggers();
