import Bluebird from 'bluebird';
import { type Bet, BetResult } from '../../../../database/models/bet.model.ts';
import { type SteveGame, SteveGameStatus } from '../../../../database/models/steveGame.model.ts';
import { findUserBalance, updateBalancePenalty } from '../../../../database/queries/balance.query.ts';
import {
    deleteIncompleteBets,
    findRefundableBets,
    findTopBet,
    resultBetsByGameId,
} from '../../../../database/queries/bets.query.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import { findInprogressGames, updateSteveGame, voidGame } from '../../../../database/queries/steveGames.query.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { getMatchById, type RiotMatchResponse, RiotPlatform } from '../../../riot-games/requests.ts';
import { getActiveLeagueGame } from '../../../game.service.ts';
import { RiotRequestError } from '../../../../tools/errors.ts';
import { discordMessages } from '../../utils.ts';
import lodash from 'lodash';
import { makeTransaction } from '../../../transaction.service.ts';
import { type Transaction, TransactionType } from '../../../../database/models/transactions.model.ts';
import { Balance } from '../../../../database/models/balance.model.ts';
import { Player } from '../../../../database/models/player.model.ts';
import { refundBet } from '../../../refund.service.ts';

const BET_TIMEOUT_MS = 60 * 60 * 1000;

export const finisher = {
    interval: 30,
    execute: async () => {
        const games = await findInprogressGames();
        const pendingGames: SteveGame[] = [];
        for (const game of games) {
            const hasGameStarted = game.gameStart > 0;
            const startTime = hasGameStarted ? game.gameStart : game.createdAt.getTime();
            const isPlayingGameExpired = Date.now() - startTime > BET_TIMEOUT_MS;
            if (!isPlayingGameExpired) {
                pendingGames.push(game);
                continue;
            }
            log(
                `FINISHER: Game ${game.gameId} has ${hasGameStarted ? 'started' : 'not started'} and has been in progress for over 1 hour`,
            );
            await refundTimedOutGame(game);
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
            const match = await findPublishedMatch(game);
            if (!match) {
                log(`FINISHER: Game ${game.gameId} not yet available from Riot`);
                continue;
            }
            await resultGame(game, match, playerInfo);
        }
    },
};

export function addPlatformToMatchId(platform: RiotPlatform, gameId: string | number) {
    return `${platform}_${gameId}`;
}

async function refundTimedOutGame(game: SteveGame) {
    try {
        const bets = await findRefundableBets(game.gameId);
        const refundResults = await Bluebird.map(bets, refundBetAndNotify, { concurrency: 5 });
        if (!refundResults.every(Boolean)) {
            log(`FINISHER: Some refunds failed for game ${game.gameId}; will retry`, LoggerType.ERROR);
            return;
        }
        await voidGame(game.gameId);
    } catch (error) {
        log(`FINISHER: Failed to refund game ${game.gameId}; will retry`, LoggerType.ERROR);
        log(error, LoggerType.ERROR);
    }
}

async function refundBetAndNotify(bet: Bet) {
    try {
        const refund = await refundBet(bet);
        if (refund) {
            await notifyRefund(refund, bet.gameId);
        }
        return true;
    } catch (error) {
        log(`FINISHER: Failed to refund bet ${bet.id} for user ${bet.userId} in game ${bet.gameId}`, LoggerType.ERROR);
        log(error, LoggerType.ERROR);
        return false;
    }
}

async function notifyRefund(refund: Transaction, gameId: string) {
    try {
        await discordMessages.sendPrivateMessageToGambler(
            `Mäng on olnud pooleli üle ühe tunni. Sinu panus tühistati ja **${refund.amount}** muumimünti tagastati. Su uus kontoseis on **${refund.balance}** muumimünti.`,
            refund.userId,
        );
    } catch (error) {
        log(`FINISHER: Failed to notify ${refund.userId} of refund for game ${gameId}`, LoggerType.ERROR);
        log(error, LoggerType.ERROR);
    }
}

async function findPublishedMatch(game: SteveGame) {
    try {
        return await getMatchById(addPlatformToMatchId(game.platformId, game.gameId));
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
    const isUpdated = await updateSteveGame(
        game.gameId,
        {
            gameStatus: SteveGameStatus.COMPLETED,
            gameResult: playerResult.win,
            gameEnd: match.info.gameEndTimestamp,
        },
        SteveGameStatus.IN_PROGRESS,
    );
    if (!isUpdated) {
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
