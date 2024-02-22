import { Player } from '../database/models/player.model';
import { findTrackedPlayer } from '../database/queries/player.query';
import { getActivegameBySummonerId, getLatestUserMatchIds } from './riot-games/requests';

export async function getActiveLeagueGame(player?: Player) {
    const trackedPlayer = player ? player : await findTrackedPlayer();
    if (!trackedPlayer) {
        throw new Error('Please add a player to track');
    }
    try {
        const game = await getActivegameBySummonerId(trackedPlayer.id);
        if(!game) {
            return ;
        };
        return game;
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
        throw error;
    }
}

export async function getLatestFinishedLeagueGame(playerInfo) {
    const [latestGame] = await getLatestUserMatchIds(playerInfo);
    return latestGame?.replace('EUN1_', '');
}
