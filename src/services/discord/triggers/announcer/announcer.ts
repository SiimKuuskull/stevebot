import { getActivegameBySummonerId, getMatchById } from '../../../../services/riot-games/requests';
import { log } from '../../../../tools/logger';
import {
    createSteveGame,
    findExistingActiveGame,
    findLastSteveGame,
} from '../../../../database/queries/steveGames.query';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { sendChannelMessage } from '../../utils';
import { findTrackedPlayer } from '../../../../database/queries/player.query';

export const announcer = {
    interval: 10,
    execute: async () => {
        const playerInfo = await findTrackedPlayer();
        const latestGameId = await findLastSteveGame(playerInfo.puuid);
        const match = await getMatchById(latestGameId);
        const activeGameId = await getActiveSteveGame();
        if (!activeGameId) {
            return;
        }
        const existingActiveGame = await findExistingActiveGame();
        if (!existingActiveGame && activeGameId !== match.info.gameId) {
            await createSteveGame({ gameId: activeGameId, gameStatus: SteveGameStatus.IN_PROGRESS });
            sendChannelMessage(`Uus mäng hakkas gameid: ${activeGameId}`);
        }
    },
};

export async function getActiveSteveGame() {
    const player = await findTrackedPlayer();
    if (!player) {
        throw new Error('Please add a player to track');
    }
    try {
        const game = await getActivegameBySummonerId(player.id);
        log(`Found active game ${game?.gameId}`);
        return game?.gameId;
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
        throw error;
    }
}
