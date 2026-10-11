import Bluebird from 'bluebird';
import { type Bet, BetResult } from '../../../../database/models/bet.model.ts';
import { SteveGameStatus } from '../../../../database/models/steveGame.model.ts';
import { findUserBalance, updateBalancePenalty } from '../../../../database/queries/balance.query.ts';
import { deleteIncompleteBets, findTopBet, resultBetsByGameId } from '../../../../database/queries/bets.query.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import {
    findInprogressGame,
    findSteveGameById,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { getMatchById } from '../../../riot-games/requests.ts';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service.ts';
import { discordMessages } from '../../utils.ts';
import lodash from 'lodash';
import { makeTransaction } from '../../../transaction.service.ts';
import { TransactionType } from '../../../../database/models/transactions.model.ts';
import { Balance } from '../../../../database/models/balance.model.ts';
import { Player } from '../../../../database/models/player.model.ts';

export const finisher = {
    interval: 30,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        const playerInfo = await findTrackedPlayer();
        if (!playerInfo) {
            return;
        }
        const activeGameId = await getActiveLeagueGame(playerInfo);
        if (activeGameId) {
            log(`FINISHER: Game ${activeGameId?.gameId} in progress`);
            return;
        }
        const finishedGameId = await getLatestFinishedLeagueGame(playerInfo.puuid);
        const match = await getMatchById(`EUN1_${finishedGameId}`);
        if (!match) {
            log('Match not found, this should not happen', LoggerType.ERROR);
            return;
        }
        const lastGame = await findSteveGameById(match.info.gameId);
        if (lastGame?.gameStatus === SteveGameStatus.IN_PROGRESS) {
            const playerResult = match.info.participants.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            if (!playerResult) {
                log(`Result not found: ${JSON.stringify(playerResult)}`, LoggerType.ERROR);
                return;
            }
            await updateSteveGame(match.info.gameId, {
                gameStatus: SteveGameStatus.COMPLETED,
                gameResult: playerResult.win,
                gameEnd: match.info.gameEndTimeStamp,
            });
            await resultBetsByGameId(match.info.gameId, {
                result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
            });
            await deleteIncompleteBets(match.info.gameId);
            const topBets = await findTopBet(match.info.gameId);
            log(
                `FINISHER: Suurimad panustajad see mäng:\n${topBets
                    .map((user) => {
                        return `${user.userId} ${user.amount} ${user.guess}\n`;
                    })
                    .toString()
                    .replaceAll(',', '')} `,
            );
            discordMessages.sendChannelMessage(
                `:bell: | Steve mäng lõppes. Steve **${playerResult.win ? 'võitis' : 'kaotas'}**!`,
            );
            await Bluebird.map(topBets, async (bet: Bet) => {
                const { amount, balance, hasPenaltyChanged } = await getBalanceChange(bet);
                let message = '';
                if (amount > 0) {
                    const transaction = await makeTransaction(
                        {
                            amount,
                            externalTransactionId: bet.id,
                            userId: bet.userId,
                            type: TransactionType.BET_WIN,
                        },
                        { hasPenaltyChanged },
                    );
                    message = await getMessage(bet, amount, transaction.balance, playerInfo);
                } else {
                    if (hasPenaltyChanged) {
                        await updateBalancePenalty(bet.userId);
                    }
                    message = await getMessage(bet, amount, balance.amount, playerInfo);
                }
                discordMessages.sendPrivateMessageToGambler(message, bet.userId);
            });
            log(`FINISHER: Game ${finishedGameId} resulted`);
        }
    },
};

async function getBalanceChange(bet: Bet) {
    const balance = (await findUserBalance(bet.userId)) as Balance;
    const amount = lodash.round(bet.amount * bet.odds - bet.amount * balance.penalty);
    if (bet.guess !== bet.result) {
        return { amount: 0, hasPenaltyChanged: Boolean(balance.penalty), balance };
    }
    return { amount, hasPenaltyChanged: Boolean(balance.penalty), balance };
}

function getMessage(bet: Bet, amount: number, balanceAmount: number, player: Player) {
    const playerResultMessage = bet.result === BetResult.WIN ? 'võitis' : 'kaotas';
    const betResultMessage = bet.guess === bet.result ? 'võitsid' : 'kaotasid';
    const balanceChangeMessage = bet.guess === bet.result ? amount - bet.amount : bet.amount;
    return `${player.gameName} **${playerResultMessage}** oma mängu! Sa ${betResultMessage} **${balanceChangeMessage}**, su uus kontoseis on **${balanceAmount}** muumimünti`;
}
