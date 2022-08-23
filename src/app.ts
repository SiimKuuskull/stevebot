import { startDiscordBot } from './services/discord/client';
import {
    getLatestUserMatchIds,
    getMatchById,
    getRiotUserBySummonerName,
    getActivegameBySummonerId,
} from './services/riot-games/requests';
import { db } from './database/db';
import { startTriggers } from './services/discord/triggers/index';
import { summonerId, summonerName } from './services/discord/triggers/announcer/announcer';

async function test() {
    const { puuid } = await getRiotUserBySummonerName(summonerName);
    const [latestMatchId] = await getLatestUserMatchIds(puuid);
    console.log(latestMatchId);
    const match = await getMatchById(latestMatchId);
    const gameId = (await getActivegameBySummonerId(summonerId)).gameId;
    const results = match.info.participants.find((participant) => participant.puuid === puuid);
    console.log(results, gameId);
}

startDiscordBot();

async function migrate() {
    await db.raw('DROP TABLE IF EXISTS steve_games');
    await db.raw('DROP TABLE IF EXISTS knex_migrations');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock');
    await db.migrate.latest();
}

async function testDatabase() {
    await migrate();
}

testDatabase();
startTriggers();

/* test(); */
