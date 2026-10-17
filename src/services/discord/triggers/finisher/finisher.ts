import Bluebird from 'bluebird';
import { type Bet, BetResult } from '../../../../database/models/bet.model.ts';
import { type SteveGame, SteveGameStatus } from '../../../../database/models/steveGame.model.ts';
import { findUserBalance, updateBalancePenalty } from '../../../../database/queries/balance.query.ts';
import {
    deleteIncompleteBets,
    findTopBet,
    resultBetsByGameId,
    voidGameBets,
} from '../../../../database/queries/bets.query.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import { findInprogressGames, updateSteveGame } from '../../../../database/queries/steveGames.query.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { getMatchById, type RiotMatchResponse } from '../../../riot-games/requests.ts';
import { getActiveLeagueGame } from '../../../game.service.ts';
import { RiotRequestError } from '../../../../tools/errors.ts';
import { discordMessages } from '../../utils.ts';
import lodash from 'lodash';
import { makeTransaction } from '../../../transaction.service.ts';
import { TransactionType } from '../../../../database/models/transactions.model.ts';
import { Balance } from '../../../../database/models/balance.model.ts';
import { Player } from '../../../../database/models/player.model.ts';

const BET_TIMEOUT_MS = 60 * 60 * 1000;

export const finisher = {
    interval: 30,
    execute: async () => {
        const games = await findInprogressGames();
        const pendingGames: SteveGame[] = [];
        for (const game of games) {
            const startTime = game.gameStart > 0 ? game.gameStart : game.createdAt.getTime();
            if (Date.now() - startTime > BET_TIMEOUT_MS) {
                try {
                    await refundTimedOutGame(game);
                } catch (error) {
                    log(`FINISHER: Failed to refund game ${game.gameId}; will retry`, LoggerType.ERROR);
                    log(error, LoggerType.ERROR);
                }
            } else {
                pendingGames.push(game);
            }
        }
        if (!pendingGames.length) {
            return;
        }
        const playerInfo = await findTrackedPlayer();
        if (!playerInfo) {
            return;
        }
        const activeGame = await getActiveLeagueGame(playerInfo);
        for (const game of pendingGames) {
            if (String(activeGame?.gameId) === game.gameId) {
                log(`FINISHER: Game ${game.gameId} in progress`);
                continue;
            }
            const match = await findPublishedMatch(game.gameId);
            if (!match) {
                log(`FINISHER: Game ${game.gameId} not yet available from Riot`);
                continue;
            }
            await resultGame(game, match, playerInfo);
        }
    },
};

async function refundTimedOutGame(game: SteveGame) {
    const refunds = await voidGameBets(game.gameId);
    for (const refund of refunds) {
        try {
            await discordMessages.sendPrivateMessageToGambler(
                `Mäng on olnud pooleli üle ühe tunni. Sinu panus tühistati ja **${refund.amount}** muumimünti tagastati. Su uus kontoseis on **${refund.balance}** muumimünti.`,
                refund.userId,
            );
        } catch (error) {
            log(`FINISHER: Failed to notify ${refund.userId} of refund for game ${game.gameId}`, LoggerType.ERROR);
            log(error, LoggerType.ERROR);
        }
    }
}

async function findPublishedMatch(gameId: string) {
    try {
        return await getMatchById(`EUN1_${gameId}`);
    } catch (error) {
        if (error instanceof RiotRequestError && [403, 404].includes(error.statusCode)) {
            return;
        }
        throw error;
    }
}

async function resultGame(game: SteveGame, match: RiotMatchResponse, playerInfo: Player) {
    const playerResult = match.info.participants.find((x) => {
        return x.puuid === playerInfo.puuid;
    });
    if (!playerResult) {
        log(`FINISHER: Tracked player not found in match ${game.gameId}`, LoggerType.ERROR);
        return;
    }
    const updated = await updateSteveGame(
        game.gameId,
        {
            gameStatus: SteveGameStatus.COMPLETED,
            gameResult: playerResult.win,
            gameEnd: match.info.gameEndTimestamp,
        },
        SteveGameStatus.IN_PROGRESS,
    );
    if (!updated) {
        return;
    }
    await resultBetsByGameId(game.gameId, {
        result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
    });
    await deleteIncompleteBets(game.gameId);
    const topBets = await findTopBet(game.gameId);
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
        if (bet.result === BetResult.VOID) {
            return;
        }
        try {
            await settleBet(bet, playerInfo);
        } catch (error) {
            log(
                `FINISHER: Failed to settle bet ${bet.id} for user ${bet.userId} in game ${bet.gameId}`,
                LoggerType.ERROR,
            );
            log(error, LoggerType.ERROR);
        }
    });
    log(`FINISHER: Game ${game.gameId} resulted`);
}

async function settleBet(bet: Bet, player: Player) {
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
        message = getMessage(bet, amount, transaction.balance, player);
    } else {
        if (hasPenaltyChanged) {
            await updateBalancePenalty(bet.userId);
        }
        message = getMessage(bet, amount, balance.amount, player);
    }
    await discordMessages.sendPrivateMessageToGambler(message, bet.userId);
}

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
