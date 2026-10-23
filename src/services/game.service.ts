import { type Player } from '../database/models/player.model.ts';
import { findTrackedPlayer } from '../database/queries/player.query.ts';
import { getActivegameByPuuId, getLatestUserMatchIds } from './riot-games/requests.ts';

export async function getActiveLeagueGame(player?: Player) {
    const trackedPlayer = player ? player : await findTrackedPlayer();
    if (!trackedPlayer) {
        throw new Error('Please add a player to track');
    }
    try {
        const game = await getActivegameByPuuId(trackedPlayer.puuid);
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

export async function getLatestFinishedLeagueGame(puuid: string) {
    const [latestGame] = (await getLatestUserMatchIds(puuid)) ?? [];
    return latestGame?.replace('EUN1_', '');
}
