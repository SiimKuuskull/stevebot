import { getActivegameBySummonerId } from '../../../../services/riot-games/requests';
import { log } from '../../../../tools/logger';
import { createSteveGame, findExistingActiveGame } from '../../../../database/queries/steveGames.query';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { sendChannelMessage } from '../../utils';

export const summonerId = 'NTOt3-RM93M20Vm25YMD0iUrayX-9GxlYBiqO3-vfCMJF8pZ1NViYcziQA';
export const summonerName = 'jyripro';

export const announcer = {
    interval: 10,
    execute: async () => {
        const activeGameId = await getActiveSteveGame();
        if (!activeGameId) {
            sendChannelMessage('Steve XP waste');
            return;
        }
        const existingActiveGame = await findExistingActiveGame();
        if (!existingActiveGame) {
            await createSteveGame({ gameId: activeGameId, gameStatus: SteveGameStatus.IN_PROGRESS });
            sendChannelMessage(`Uus mäng hakkas gameid: ${activeGameId}`);
        }
    },
};

async function getActiveSteveGame() {
    try {
        const game = await getActivegameBySummonerId(summonerId);
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
