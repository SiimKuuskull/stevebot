import {
    createTrackedGameWithMeta,
    findSteveGameByMatch,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query.ts';
import { discordMessages } from '../../utils.ts';
import { findTrackedPlayers } from '../../../../database/queries/player.query.ts';
import { getActiveLeagueGame, getLatestFinishedMatchId } from '../../../game.service.ts';
import { addPlatformToMatchId, RIOT_PLATFORM_LABEL } from '../../../riot-games/requests.ts';
import { SteveGameStatus } from '../../../../database/models/steveGame.model.ts';
import { type Player } from '../../../../database/models/player.model.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import Bluebird from 'bluebird';

export const announcer = {
    interval: 10,
    execute: async () => {
        const players = await findTrackedPlayers();
        await Bluebird.map(
            players,
            async (player) => {
                try {
                    await announcePlayerGame(player);
                } catch (error) {
                    log(`ANNOUNCER: Failed to process player ${player.id}`, LoggerType.ERROR);
                    log(error, LoggerType.ERROR);
                }
            },
            { concurrency: 3 },
        );
    },
};

async function announcePlayerGame(player: Player) {
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
            await updateSteveGame(existingGame.id, { gameStart: game.gameStartTime }, SteveGameStatus.IN_PROGRESS);
        }
        return;
    }
    const finishedMatchId = await getLatestFinishedMatchId(player.puuid);
    const isNewGame = !existingGame && finishedMatchId !== addPlatformToMatchId(game.platformId, game.gameId);
    if (!isNewGame) {
        return;
    }
    const steveGame = await createTrackedGameWithMeta(
        {
            gameId: game.gameId.toString(),
            playerId: player.id,
            platformId: game.platformId,
            gameStart: game.gameStartTime || Date.now(),
        },
        game,
    );
    if (!steveGame) {
        return;
    }
    await discordMessages.sendChannelMessage(
        `:loudspeaker: | [${RIOT_PLATFORM_LABEL[steveGame.platformId]}] **${player.gameName}** läks just uude ${
            gameMode[game.gameQueueConfigId]
        } mängu. Kasuta */place-bet* ja ennusta, kuidas tal läheb!`,
    );
}

const gameMode: Record<number, string> = {
    430: 'blind',
    400: 'normal',
    420: 'ranked solo',
    440: 'ranked flex',
    450: 'ARAM',
    480: 'swiftplay',
    490: 'quickplay',
};
