import {
    createSteveGame,
    findInprogressGame,
    findSteveGameById,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query.ts';
import { discordMessages } from '../../utils.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import { gameMode, getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service.ts';
import { createGameMeta } from '../../../../database/queries/gameMeta.query.ts';

export const announcer = {
    interval: 10,
    execute: async () => {
        const player = await findTrackedPlayer();
        if (!player) {
            return;
        }
        const game = await getActiveLeagueGame(player);
        if (!game) {
            return;
        }
        if (!gameMode[game.gameQueueConfigId]) {
            return;
        }
        const existingInProgressGame = await findInprogressGame();
        if (existingInProgressGame?.gameId === game?.gameId.toString()) {
            return;
        }
        if (existingInProgressGame?.gameStart === 0 && game.gameStartTime > 0) {
            await updateSteveGame(String(game.gameId), { gameStart: game.gameStartTime });
        }
        const finishedGameId = await getLatestFinishedLeagueGame(player.puuid);
        const existingGame = await findSteveGameById(game.gameId.toString());
        const isNewGame = !existingGame && finishedGameId !== game.gameId.toString();
        if (!isNewGame) {
            return;
        }
        const steveGame = await createSteveGame({
            gameId: game.gameId.toString(),
            gameStart: game.gameStartTime || Date.now(),
        });
        await createGameMeta({ meta: game, steveGameId: steveGame.id });
        discordMessages.sendChannelMessage(
            `:loudspeaker: | **${player.gameName}** läks just uude ${
                gameMode[game.gameQueueConfigId]
            } mängu. Kasuta */place-bet* ja ennusta, kuidas tal läheb!`,
        );
    },
};
