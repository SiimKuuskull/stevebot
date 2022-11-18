import {
    createSteveGame,
    findInprogressGame,
    findSteveGameById,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query';
import { sendChannelMessage } from '../../utils';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';

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
        if (existingInProgressGame?.gameStart === 0 && game.gameStartTime > 0) {
            await updateSteveGame(String(game.gameId), { gameStart: game.gameStartTime });
        }
        const finishedGameId = await getLatestFinishedLeagueGame(player.puuid);
        const existingGame = await findSteveGameById(game.gameId.toString());
        const isNewGame = !existingGame && finishedGameId !== game.gameId.toString();
        if (!isNewGame) {
            return;
        }
        await createSteveGame({
            gameId: game.gameId.toString(),
            gameStart: game.gameStartTime || Date.now(),
        });
        sendChannelMessage(
            `:loudspeaker: | **${player.name}** läks just uude ${
                gameMode[game.gameMode] || 'featured gamemode'
            } mängu. Kasuta */place-bet* ja ennusta, kuidas tal läheb!`,
        );
    },
};

const gameMode = {
    CLASSIC: 'normal',
    RANKED: 'ranked',
    ARAM: 'ARAM',
};
