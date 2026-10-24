import { addPlayer, unTrackAll } from '../database/queries/player.query.ts';
import { log, LoggerType } from '../tools/logger.ts';
import { getRiotUserByRiotId, RiotPlatform } from './riot-games/requests.ts';

export async function createProGamers() {
    const gameName = process.env.TRACKED_PLAYER || 'Skelegon';
    const tagLine = process.env.TRACKED_PLAYER_TAG || 'EUNE';
    const platformId = (process.env.TRACKED_PLAYER_REGION || 'EUN1').toUpperCase() as RiotPlatform;

    log(`Adding pro gamer: ${gameName}#${tagLine} (${platformId})`);

    await unTrackAll();

    try {
        const riotUser = await getRiotUserByRiotId(gameName, tagLine);
        await addPlayer({
            puuid: riotUser?.puuid,
            gameName: riotUser?.gameName,
            tagLine: riotUser?.tagLine,
            platformId,
            //accountId: riotUserByPuuId.accountId,
            //summonerId: riotUserByPuuId.id,
            isTracked: true,
        });
    } catch (error) {
        log(error, LoggerType.ERROR);
    }
}
