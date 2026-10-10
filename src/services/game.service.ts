import { type Player } from '../database/models/player.model.ts';
import { findTrackedPlayer } from '../database/queries/player.query.ts';
import { findInprogressGames, updateSteveGame } from '../database/queries/steveGames.query.ts';
import { getActivegameByPuuId, getLatestUserMatchIds, getMatchById } from './riot-games/requests.ts';
import { SteveGameStatus } from '../database/models/steveGame.model.ts';
import { log } from '../tools/logger.ts';

export async function getActiveLeagueGame(player?: Player) {
    const trackedPlayer = player ? player : await findTrackedPlayer();
    if (!trackedPlayer) {
        throw new Error('Please add a player to track');
    }
    try {
        const game = await getActivegameByPuuId(trackedPlayer.puuid);
        if (!game) {
            return;
        }
        return game;
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
        throw error;
    }
}

export async function getLatestFinishedLeagueGame(playerInfo) {
    const [latestGame] = await getLatestUserMatchIds(playerInfo);
    return latestGame?.replace('EUN1_', '');
}

export async function finishOldInprogressGames() {
    const inprogressGames = await findInprogressGames();
    const playerInfo = await findTrackedPlayer();
    const steveMatchIds = await getLatestUserMatchIds(playerInfo?.puuid);
    let oldGameCount = 0;
    await Promise.all(
        inprogressGames.map(async (game) => {
            if (steveMatchIds.includes(`EUN1_${game.gameId}`)) {
                oldGameCount = oldGameCount + 1;
                const match = await getMatchById(`EUN1_${game.gameId}`);
                const playerResult = match.info.participants.find((x) => {
                    return x.puuid === playerInfo.puuid;
                });
                await updateSteveGame(game.gameId, {
                    gameStatus: SteveGameStatus.COMPLETED,
                    gameResult: playerResult.win,
                    gameEnd: match.info.gameEndTimeStamp,
                });
            }
            return oldGameCount;
        }),
    );
    log(`Found ${oldGameCount} old Steve's games. Check database for more details`);

    return;
}
