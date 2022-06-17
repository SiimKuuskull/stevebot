import { startDiscordBot } from './services/discord/client';
import { getLatestUserMatchIds, getMatchById, getRiotUserBySummonerName } from './services/riotGames';

async function test() {
    const { puuid } = await getRiotUserBySummonerName('Loviatar');
    const [latestMatchId] = await getLatestUserMatchIds(puuid);
    const match = await getMatchById(latestMatchId);
    const results = match.info.participants.find((participant) => participant.puuid === puuid);
    console.log(results);
}

startDiscordBot();
