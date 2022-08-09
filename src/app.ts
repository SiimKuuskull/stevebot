import { startDiscordBot } from './services/discord/client';
import { getLatestUserMatchIds, getMatchById, getRiotUserBySummonerName } from './services/riot-games/requests';
import { db } from './database/db';

async function test() {
    const { puuid } = await getRiotUserBySummonerName('Loviatar');
    const [latestMatchId] = await getLatestUserMatchIds(puuid);
    const match = await getMatchById(latestMatchId);
    const results = match.info.participants.find((participant) => participant.puuid === puuid);
    console.log(results);
}

startDiscordBot();

async function migrate() {
    await db.raw('DROP TABLE IF EXISTS steve_games');
    await db.raw('DROP TABLE IF EXISTS knex_migrations');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock');
    await db.migrate.latest();
    console.log('migration töötab');
}

async function testDatabase() {
    await migrate();
}

testDatabase();
