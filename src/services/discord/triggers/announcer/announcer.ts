import {
    createSteveGame,
    findInprogressGame,
    findSteveGameById,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query';
import { sendChannelMessage } from '../../utils';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { createGameMeta } from '../../../../database/queries/gameMeta.query';
import { getRiotUserRankedEntries } from '../../../riot-games/requests';

export const announcer = {
    interval: 10,
    execute: async () => {
        const player = await findTrackedPlayer();
        console.log(player);
        const playerRankedEntries = await getRiotUserRankedEntries(player?.id);
        console.log(playerRankedEntries);
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
        const steveGame = await createSteveGame({
            gameId: game.gameId.toString(),
            gameStart: game.gameStartTime || Date.now(),
        });
        await createGameMeta({ meta: game, steveGameId: steveGame.id });
        sendChannelMessage(
            `:loudspeaker: | **${player.name}** läks just uude ${
                gameMode[game.gameQueueConfigId] || 'featured gamemode'
            } mängu. Kasuta */place-bet* ja ennusta, kuidas tal läheb!`,
        );
    },
};

const gameMode = {
    430: 'blind',
    400: 'normal',
    420: 'ranked solo',
    440: 'ranked flex',
    450: 'ARAM',
    490: 'quickplay',
};
