import { map } from 'bluebird';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { changeUserBalanceWinByGuess, findUserBalance } from '../../../../database/queries/balance.query';
import { findTopBet, updateUserBetDecision } from '../../../../database/queries/placeBet.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log, LoggerType } from '../../../../tools/logger';
import { getMatchById } from '../../../riot-games/requests';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../game';
import { sendChannelMessage, sendPrivateMessageToGambler } from '../../utils';

export const finisher = {
    interval: 30,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        try {
            const playerInfo = await findTrackedPlayer();
            const activeGameId = await getActiveLeagueGame(playerInfo);
            if (activeGameId) {
                log(`Game ${activeGameId} in progress`);
                return;
            }
            const finishedGameId = await getLatestFinishedLeagueGame(playerInfo.puuid);
            const match = await getMatchById(finishedGameId);
            const playerResult = match.info.participants.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED, gameResult: playerResult.win });
            await updateUserBetDecision(match.info.gameId, { result: playerResult.win });
            const topBetsSorted = await findTopBet(match.info.gameId);
            topBetsSorted.forEach((user) => {
                log(`Suurimad panustajad see mäng:  ${user.userName} ${user.amount} ${user.guess}`);
            });
            sendChannelMessage(`Steve mäng lõppes. Steve ${playerResult.win ? 'võitis' : 'kaotas'}!`);
            await map(topBetsSorted, async (betUserDecision) => {
                if (playerResult.win === true && betUserDecision?.guess === playerResult.win) {
                    const updatedBalance = await changeUserBalanceWinByGuess(true, betUserDecision.amount);
                    sendPrivateMessageToGambler(
                        `Steve võitis oma mängu! Sa võitsid ${betUserDecision.amount}, su uus kontoseis on ${updatedBalance.amount} muumicoini`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === false && betUserDecision?.guess === playerResult.win) {
                    const updatedBalance = await changeUserBalanceWinByGuess(true, betUserDecision.amount);
                    sendPrivateMessageToGambler(
                        `Steve kaotas oma mängu! Sa võitsid ${betUserDecision.amount}, su uus kontoseis on ${updatedBalance.amount} muumicoini`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === true && betUserDecision.guess !== playerResult.win) {
                    const newUserBalance = await findUserBalance(betUserDecision.userId);
                    sendPrivateMessageToGambler(
                        `Steve võitis oma mängu!  ${match.info.gameId} Sa kaotasid ${betUserDecision.amount}, su uus kontoseis on ${newUserBalance.amount} muumicoini`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === false && betUserDecision.guess !== playerResult.win) {
                    const newUserBalance = await findUserBalance(betUserDecision.userId);
                    sendPrivateMessageToGambler(
                        `Steve kaotas oma mängu! Sa kaotasid ${betUserDecision.amount}, su uus kontoseis on ${newUserBalance.amount} muumicoini`,
                        betUserDecision.userName,
                    );
                }
            });
            log(`Game ${finishedGameId} resulted`);
        } catch (error) {
            log(error, LoggerType.ERROR);
        }
    },
};
