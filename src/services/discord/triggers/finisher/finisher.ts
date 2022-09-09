import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { changeUserBalanceWinByGuess, findUserBalance } from '../../../../database/queries/balance.query';
import { findUserBetDecisionByGameId, updateUserBetDecision } from '../../../../database/queries/placeBet.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, findLastSteveGame, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getActivegameBySummonerId, getMatchById } from '../../../riot-games/requests';
import { sendChannelMessage } from '../../utils';

export const finisher = {
    interval: 5,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        const playerInfo = await findTrackedPlayer();
        try {
            const activeGameId = (await getActivegameBySummonerId(playerInfo.id)).gameId;
            if (!activeGameId) {
                const lastSteveGame = await findLastSteveGame();
                const match = await getMatchById(lastSteveGame);
                const matchResult = match.info.participants;
                const playerResult = matchResult.find((x) => {
                    return x.puuid === playerInfo.puuid;
                });
                await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED, gameResult: playerResult.win });
                await updateUserBetDecision(game.id, { result: playerResult.win });
                const betDecision = await findUserBetDecisionByGameId(match.info.gameId);
                if ((playerResult.win = true && betDecision.guess === playerResult.win)) {
                    await changeUserBalanceWinByGuess(true, betDecision.amount);
                    const winnerBalance = await findUserBalance(betDecision.userId);
                    sendChannelMessage(
                        `Steve võitis oma mängu! Sa võitsid ${betDecision}, su uus kontoseis on ${winnerBalance.amount}`,
                    );
                }
                if (playerResult.win === false && betDecision.guess === playerResult.win) {
                    await changeUserBalanceWinByGuess(true, betDecision.amount);
                    const newUserBalance = await findUserBalance(betDecision.userId);
                    sendChannelMessage(
                        `Steve kaotas oma mängu! Sa võitsid ${betDecision}, su uus kontoseis on ${newUserBalance.amount}`,
                    );
                }
                if (playerResult.win === true && betDecision.guess !== playerResult.win) {
                    const newUserBalance = await findUserBalance(betDecision.userId);
                    sendChannelMessage(
                        `Steve kaotas oma mängu! Sa kaotasid ${betDecision}, su uus kontoseis on ${newUserBalance.amount}`,
                    );
                }
                if (playerResult.win === false && betDecision.guess !== playerResult.win) {
                    const newUserBalance = await findUserBalance(betDecision.userId);
                    sendChannelMessage(
                        `Steve kaotas oma mängu! Sa kaotasid ${betDecision}, su uus kontoseis on ${newUserBalance.amount}`,
                    );
                }
                log('Steve mäng sai läbi! Andmebaas uuendatud!');

                if (betDecision.result === true) {
                    sendChannelMessage('Steve mäng lõppes. Steve võitis!');
                }
                if (betDecision.result === false) {
                    sendChannelMessage('Steve mäng lõppes. Steve kaotas!');
                }
            }
        } catch (error) {
            const lastSteveGame = await findLastSteveGame();
            const match = await getMatchById(lastSteveGame);
            const matchResult = match.info.participants;
            const playerResult = matchResult.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED, gameResult: playerResult.win });
            await updateUserBetDecision(game.id, { result: playerResult.win });
            const betDecision = await findUserBetDecisionByGameId(match.info.gameId);
            log(betDecision);
            if (betDecision.result === true) {
                sendChannelMessage('Steve mäng lõppes. Steve võitis!');
            }
            if (betDecision.result === false) {
                sendChannelMessage('Steve mäng lõppes. Steve kaotas!');
            }
            if (playerResult.win == true && betDecision.guess === playerResult.win) {
                await changeUserBalanceWinByGuess(true, betDecision.amount);
                const winnerBalance = await findUserBalance(betDecision.userId);
                sendChannelMessage(
                    `Steve võitis oma mängu! Sa võitsid ${betDecision.amount}, su uus kontoseis on ${winnerBalance.amount}`,
                );
            }
            if (playerResult.win === false && betDecision.guess === playerResult.win) {
                await changeUserBalanceWinByGuess(true, betDecision.amount);
                const newUserBalance = await findUserBalance(betDecision.userId);
                sendChannelMessage(
                    `Steve kaotas oma mängu! Sa võitsid ${betDecision.amount}, su uus kontoseis on ${newUserBalance.amount}`,
                );
            }
            if (playerResult.win === true && betDecision.guess !== playerResult.win) {
                const newUserBalance = await findUserBalance(betDecision.userId);
                sendChannelMessage(
                    `Steve kaotas oma mängu! Sa kaotasid ${betDecision.amount}, su uus kontoseis on ${newUserBalance.amount}`,
                );
            }
            if (playerResult.win === false && betDecision.guess !== playerResult.win) {
                const newUserBalance = await findUserBalance(betDecision.userId);
                sendChannelMessage(
                    `Steve kaotas oma mängu! Sa kaotasid ${betDecision.amount}, su uus kontoseis on ${newUserBalance.amount}`,
                );
            }
            log('Steve mäng sai läbi! Andmebaas uuendatud!');
        }
    },
};
