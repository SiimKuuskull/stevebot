import {
    createSteveGame,
    findSteveGameByMatch,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query.ts';
import { discordMessages } from '../../utils.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import { getActiveLeagueGame, getLatestFinishedMatchId } from '../../../game.service.ts';
import { createGameMeta } from '../../../../database/queries/gameMeta.query.ts';
import { addPlatformToMatchId, RIOT_PLATFORM_LABEL } from '../../../riot-games/requests.ts';
import { SteveGameStatus } from '../../../../database/models/steveGame.model.ts';

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
        const existingGame = await findSteveGameByMatch({
            platformId: game.platformId,
            gameId: String(game.gameId),
            playerId: player.id,
        });
        if (existingGame?.gameStatus === SteveGameStatus.IN_PROGRESS) {
            if (existingGame.gameStart === 0 && game.gameStartTime > 0) {
                await updateSteveGame(existingGame.id, { gameStart: game.gameStartTime });
            }
            return;
        }
        const finishedMatchId = await getLatestFinishedMatchId(player.puuid);
        const isNewGame = !existingGame && finishedMatchId !== addPlatformToMatchId(game.platformId, game.gameId);
        if (!isNewGame) {
            return;
        }
        const steveGame = await createSteveGame({
            gameId: game.gameId.toString(),
            playerId: player.id,
            platformId: game.platformId,
            gameStart: game.gameStartTime || Date.now(),
        });
        await createGameMeta({ meta: game, steveGameId: steveGame.id });
        discordMessages.sendChannelMessage(
            `:loudspeaker: | [${RIOT_PLATFORM_LABEL[player.platformId]}] **${player.gameName}** läks just uude ${
                gameMode[game.gameQueueConfigId]
            } mängu. Kasuta */place-bet* ja ennusta, kuidas tal läheb!`,
        );
    },
};

const gameMode: Record<number, string> = {
    430: 'blind',
    400: 'normal',
    420: 'ranked solo',
    440: 'ranked flex',
    450: 'ARAM',
    480: 'swiftplay',
    490: 'quickplay',
};
