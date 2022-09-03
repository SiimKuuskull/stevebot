import 'source-map-support/register';
import { startDiscordBot } from './services/discord/client';
import { runDatabaseMigrations } from './database/db';
import { startTriggers } from './services/discord/triggers';
import {
    getActivegameBySummonerId,
    getLatestUserMatchIds,
    getMatchById,
    getRiotUserBySummonerName,
} from './services/riot-games/requests';
import { log } from './tools/logger';
import { findLastSteveGame, playerInfo } from './database/queries/steveGames.query';

startDiscordBot();
runDatabaseMigrations();
startTriggers();
/* (async () => {
})(); */
