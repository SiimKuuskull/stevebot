import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { changeUserBalanceWinByGuess, findUserBalance } from '../../../../database/queries/balance.query';
import { findUserBetDecisionByGameId, updateUserBetDecision } from '../../../../database/queries/placeBet.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, findLastSteveGame, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log, LoggerType } from '../../../../tools/logger';
import { getMatchById } from '../../../riot-games/requests';
import { sendChannelMessage } from '../../utils';
import { getActiveSteveGame } from '../announcer/announcer';

export const finisher = {
    interval: 30,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        try {
            const playerInfo = await findTrackedPlayer();
            const activeGameId = await getActiveSteveGame();
            if (!activeGameId) {
                const lastSteveGame = await findLastSteveGame(playerInfo.puuid);
                const match = await getMatchById(lastSteveGame);
                const matchResult = match.info.participants;
                const playerResult = matchResult.find((x) => {
                    return x.puuid === playerInfo.puuid;
                });
                await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED, gameResult: playerResult.win });
                await updateUserBetDecision(match.info.gameId, { result: playerResult.win });
                const betDecision = await findUserBetDecisionByGameId(match.info.gameId);
                if (!betDecision) {
                    const zeroBets = 'No bet has been made';
                    log(zeroBets);
                }
                if (playerResult.win === true) {
                    sendChannelMessage('Steve mäng lõppes. Steve võitis!');
                }
                if (playerResult.win === false) {
                    sendChannelMessage('Steve mäng lõppes. Steve kaotas!');
                }
                if (betDecision) {
                    if (playerResult.win === true && betDecision?.guess === playerResult.win) {
                        await changeUserBalanceWinByGuess(true, betDecision.amount);
                        const winnerBalance = await findUserBalance(betDecision.userId);
                        sendChannelMessage(
                            `Steve võitis oma mängu! Sa võitsid ${betDecision.amount}, su uus kontoseis on ${winnerBalance.amount}`,
                        );
                    }
                    if (playerResult.win === false && betDecision?.guess === playerResult.win) {
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
                }
                log('Steve mäng sai läbi! Andmebaas uuendatud!');
            }
        } catch (error) {
            log(error, LoggerType.ERROR);
        }
    },
};
