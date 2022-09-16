import { getMatchById } from '../../../../services/riot-games/requests';
import { createSteveGame, findInprogressGame } from '../../../../database/queries/steveGames.query';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { sendChannelMessage } from '../../utils';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../game';

export const announcer = {
    interval: 10,
    execute: async () => {
        const player = await findTrackedPlayer();
        const currentLeagueGameId = await getActiveLeagueGame(player);
        if (!currentLeagueGameId) {
            return;
        }
        const gameId = await getLatestFinishedLeagueGame(player.puuid);
        const match = await getMatchById(gameId);
        const existingInProgressGame = await findInprogressGame();
        if (!existingInProgressGame && currentLeagueGameId !== match.info.gameId) {
            await createSteveGame({ gameId: currentLeagueGameId, gameStatus: SteveGameStatus.IN_PROGRESS });
            sendChannelMessage(`Uus mäng hakkas gameid: ${currentLeagueGameId}`);
        }
    },
};
