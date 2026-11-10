import { type Player } from '../database/models/player.model.ts';
import { getActivegameByPuuId, getLatestUserMatchIds } from './riot-games/requests.ts';

export async function getActiveLeagueGame(player: Player) {
    if (!player) {
        throw new Error('A player is required to fetch an active game');
    }
    try {
        const game = await getActivegameByPuuId(player.puuid, player.platformId);
        if (!game) {
            return;
        }
        return game;
    } catch (error: any) {
        if (error.statusCode === 404) {
            return;
        }
        throw error;
    }
}

export async function getLatestFinishedMatchId(puuid: string) {
    const [latestMatchId] = (await getLatestUserMatchIds(puuid)) ?? [];
    return latestMatchId;
}
