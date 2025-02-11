import { addPlayer, unTrackAll } from '../database/queries/player.query';
import { log, LoggerType } from '../tools/logger';
import { getRiotUserByPuuId, getRiotUserByRiotId } from './riot-games/requests';

export async function createProGamers() {
    const trackedPlayerGameName = 'Skelegon';
    const trackedPlayerTagLine = 'EUNE';
    const trackedPlayer = `${trackedPlayerGameName}/${trackedPlayerTagLine}`;
    const summonerNames = [trackedPlayer];

    log(`Adding pro gamers: ${summonerNames}`);

    await unTrackAll();

    for (const summonerName of summonerNames) {
        try {
            const riotUser = await getRiotUserByRiotId(summonerName);
            const riotUserByPuuId = await getRiotUserByPuuId(riotUser.puuid);
            const template = {
                puuid: riotUser.puuid,
                gameName: riotUser.gameName,
                tagLine: riotUser.tagLine,
                accountId: riotUserByPuuId.accountId,
                summonerId: riotUserByPuuId.id,
                isTracked: trackedPlayer === summonerName,
            };
            await addPlayer(template);
        } catch (error) {
            log(error, LoggerType.ERROR);
        }
    }
}
