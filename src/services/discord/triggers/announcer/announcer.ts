import { createSteveGame, findInprogressGame } from '../../../../database/queries/steveGames.query';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { sendChannelMessage } from '../../utils';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../game';

export const announcer = {
    interval: 10,
    execute: async () => {
        const player = await findTrackedPlayer();
        const game = await getActiveLeagueGame(player);
        if (!game) {
            return;
        }
        const existingInProgressGame = await findInprogressGame();
        if (existingInProgressGame?.gameId === game.gameId.toString()) {
            return;
        }
        const euneGameId = await getLatestFinishedLeagueGame(player.puuid);
        if (game.gameId.toString() !== euneGameId.replace('EUN1_', '')) {
            await createSteveGame({
                gameId: game.gameId.toString(),
                gameStart: game.gameStartTime,
                gameStatus: SteveGameStatus.IN_PROGRESS,
            });
            const gameMode = {
                CLASSIC: 'normal',
                RANKED: 'ranked',
            };
            sendChannelMessage(`${player.name} läks just uude ${gameMode[game.gameMode]} mängu`);
        }
    },
};
