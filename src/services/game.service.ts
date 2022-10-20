import { Player } from '../database/models/player.model';
import { findTrackedPlayer } from '../database/queries/player.query';
import { log } from '../tools/logger';
import { getActivegameBySummonerId, getLatestUserMatchIds } from './riot-games/requests';

export async function getActiveLeagueGame(player?: Player) {
    const trackedPlayer = player ? player : await findTrackedPlayer();
    if (!trackedPlayer) {
        throw new Error('Please add a player to track');
    }
    try {
        const game = await getActivegameBySummonerId(trackedPlayer.id);
        log(`Found active game ${game?.gameId}`);
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

export async function getActiveLeagueGameLength() {
    const { id: playerId } = await findTrackedPlayer();
    const activeSteveGame = await getActivegameBySummonerId(playerId);
    const currentGameLength = activeSteveGame.gameLength;
    return currentGameLength;
}

export async function getActiveLeagueGameStart() {
    const { id: playerId } = await findTrackedPlayer();
    const game = await getActivegameBySummonerId(playerId);
    if (!game) {
        return;
    }
    return game.gameStartTime;
}
