import { addPlayer, unTrackAll } from '../database/queries/player.query';
import { log, LoggerType } from '../tools/logger';
import { getRiotUserByRiotId } from './riot-games/requests';

export async function createProGamers() {
    const trackedPlayerGameName = process.env.TRACKED_PLAYER || 'Skelegon';
    const trackedPlayerTagLine = process.env.TRACKED_PLAYER_TAG || 'EUNE';
    const trackedPlayer = `${trackedPlayerGameName}/${trackedPlayerTagLine}`;
    const summonerNames = [trackedPlayer];

    log(`Adding pro gamers: ${summonerNames}`);

    await unTrackAll();

    for (const summonerName of summonerNames) {
        try {
            const riotUser = await getRiotUserByRiotId(summonerName);
            const template = {
                puuid: riotUser.puuid,
                gameName: riotUser.gameName,
                tagLine: riotUser.tagLine,
                //accountId: riotUserByPuuId.accountId,
                //summonerId: riotUserByPuuId.id,
                isTracked: trackedPlayer === summonerName,
            };
            await addPlayer(template);
        } catch (error) {
            log(error, LoggerType.ERROR);
        }
    }
}
