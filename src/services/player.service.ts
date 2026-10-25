import { createInitialTrackedPlayer, hasPlayers } from '../database/queries/player.query.ts';
import { log, LoggerType } from '../tools/logger.ts';
import { getRiotUserByRiotId, RiotPlatform } from './riot-games/requests.ts';

export async function createProGamers() {
    if (await hasPlayers()) {
        return;
    }
    const gameName = process.env.TRACKED_PLAYER || 'Skelegon';
    const tagLine = process.env.TRACKED_PLAYER_TAG || 'EUNE';
    const platformId = (process.env.TRACKED_PLAYER_REGION || 'EUN1').toUpperCase() as RiotPlatform;

    log(`Looking up initial tracked player: ${gameName}#${tagLine} (${platformId})`);

    try {
        const riotUser = await getRiotUserByRiotId(gameName, tagLine);
        if (!riotUser) {
            throw new Error(`Riot account not found: ${gameName}#${tagLine}`);
        }
        await createInitialTrackedPlayer({
            puuid: riotUser.puuid,
            gameName: riotUser.gameName,
            tagLine: riotUser.tagLine,
            platformId,
        });
    } catch (error) {
        log(error, LoggerType.ERROR);
    }
}
