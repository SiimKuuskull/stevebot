import { startDiscordBot } from './services/discord/client';
import { runDatabaseMigrations } from './database/db';

startDiscordBot();
runDatabaseMigrations();
