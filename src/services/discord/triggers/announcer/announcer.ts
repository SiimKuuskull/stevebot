import { getActivegameBySummonerId } from '../../../../services/riot-games/requests';
import { log } from '../../../../tools/logger';
import { createSteveGame, findExistingActiveGame, playerInfo } from '../../../../database/queries/steveGames.query';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { sendChannelMessage } from '../../utils';

export const announcer = {
    interval: 10,
    execute: async () => {
        const activeGameId = await getActiveSteveGame();
        if (!activeGameId) {
            return;
        }
        const existingActiveGame = await findExistingActiveGame();
        if (!existingActiveGame && activeGameId) {
            await createSteveGame({ gameId: activeGameId, gameStatus: SteveGameStatus.IN_PROGRESS });
            sendChannelMessage(`Uus mäng hakkas gameid: ${activeGameId}`);
        }
    },
};

async function getActiveSteveGame() {
    try {
        const game = await getActivegameBySummonerId(playerInfo.id);
        if (game) {
            log(`Found active game ${game.gameId}`);
        }
        return game?.gameId;
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
    }
}
