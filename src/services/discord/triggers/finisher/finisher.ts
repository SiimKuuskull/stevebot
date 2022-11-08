import { map } from 'bluebird';
import { BetResult } from '../../../../database/models/bet.model';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { changeUserBalanceWinByGuess, findUserBalance } from '../../../../database/queries/balance.query';
import { findTopBet, updateUserBetDecision } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, findSteveGameById, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getMatchById } from '../../../riot-games/requests';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { sendChannelMessage, sendPrivateMessageToGambler } from '../../utils';

export const finisher = {
    interval: 30,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        const playerInfo = await findTrackedPlayer();
        const activeGameId = await getActiveLeagueGame(playerInfo);
        if (activeGameId) {
            log(`Game ${activeGameId?.gameId} in progress`);
            return;
        }
        const finishedGameId = await getLatestFinishedLeagueGame(playerInfo.puuid);
        const match = await getMatchById(`EUN1_${finishedGameId}`);
        const lastGame = await findSteveGameById(match.info.gameId);
        if (lastGame?.gameStatus === SteveGameStatus.IN_PROGRESS) {
            const playerResult = match.info.participants.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            await updateSteveGame(match.info.gameId, {
                gameStatus: SteveGameStatus.COMPLETED,
                gameResult: playerResult.win,
            });
            await updateUserBetDecision(match.info.gameId, {
                result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
            });
            const topBetsSorted = await findTopBet(match.info.gameId);
            topBetsSorted.forEach((user) => {
                log(`Suurimad panustajad see mäng:  ${user.userName} ${user.amount} ${user.guess}`);
            });
            sendChannelMessage(`:bell: Steve mäng lõppes. Steve ${playerResult.win ? 'võitis' : 'kaotas'}! :bell: \n`);
            await map(topBetsSorted, async (betUserDecision) => {
                if (playerResult.win === true && betUserDecision?.guess === BetResult.WIN) {
                    const updatedBalance = await changeUserBalanceWinByGuess(betUserDecision.amount, lastGame.gameId);
                    sendPrivateMessageToGambler(
                        `Steve võitis oma mängu! Sa võitsid ${
                            betUserDecision.amount * betUserDecision.odds
                        }, su uus kontoseis on ${updatedBalance.amount} muumimünti`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === false && betUserDecision?.guess === BetResult.LOSE) {
                    const updatedBalance = await changeUserBalanceWinByGuess(betUserDecision.amount, lastGame.gameId);
                    sendPrivateMessageToGambler(
                        `Steve kaotas oma mängu! Sa võitsid ${
                            betUserDecision.amount * betUserDecision.odds
                        }, su uus kontoseis on ${updatedBalance.amount} muumimünti`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === true && betUserDecision?.guess === BetResult.LOSE) {
                    const newUserBalance = await findUserBalance(betUserDecision.userId);
                    sendPrivateMessageToGambler(
                        `Steve võitis oma mängu! Sa kaotasid ${betUserDecision.amount}, su uus kontoseis on ${newUserBalance.amount} muumimünti`,
                        betUserDecision.userName,
                    );
                }
                if (playerResult.win === false && betUserDecision?.guess === BetResult.WIN) {
                    const newUserBalance = await findUserBalance(betUserDecision.userId);
                    sendPrivateMessageToGambler(
                        `Steve kaotas oma mängu! Sa kaotasid ${betUserDecision.amount}, su uus kontoseis on ${newUserBalance.amount} muumimünti`,
                        betUserDecision.userName,
                    );
                }
            });
            log(`Game ${finishedGameId} resulted`);
        }
    },
};
