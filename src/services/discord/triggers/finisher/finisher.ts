import Bluebird from 'bluebird';
import { type Bet, BetResult } from '../../../../database/models/bet.model.ts';
import { type SteveGame, SteveGameStatus } from '../../../../database/models/steveGame.model.ts';
import { findUserBalance, updateBalancePenalty } from '../../../../database/queries/balance.query.ts';
import {
    deleteIncompleteBets,
    findRefundableBets,
    findTopBet,
    resultBetsBySteveGameId,
} from '../../../../database/queries/bets.query.ts';
import { findPlayerById } from '../../../../database/queries/player.query.ts';
import { findInprogressGames, updateSteveGame, voidGame } from '../../../../database/queries/steveGames.query.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import {
    addPlatformToMatchId,
    getMatchById,
    RIOT_PLATFORM_LABEL,
    type RiotMatchResponse,
} from '../../../riot-games/requests.ts';
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
        const players = new Map<number, Player | undefined>();
        const activeGames = new Map<string, ReturnType<typeof getActiveLeagueGame>>();
        const matches = new Map<string, ReturnType<typeof findPublishedMatch>>();
        for (const game of pendingGames) {
            try {
                if (game.playerId == null) {
                    log(`FINISHER: Game ${game.id} has no recorded owner; awaiting timeout`, LoggerType.ERROR);
                    continue;
                }
                if (!players.has(game.playerId)) {
                    players.set(game.playerId, await findPlayerById(game.playerId));
                }
                const player = players.get(game.playerId);
                if (!player) {
                    log(`FINISHER: Owner ${game.playerId} for game ${game.id} is missing`, LoggerType.ERROR);
                    continue;
                }
                const playerInfo = { ...player, platformId: game.platformId };
                const playerKey = `${player.id}:${game.platformId}`;
                if (!activeGames.has(playerKey)) {
                    activeGames.set(playerKey, getActiveLeagueGame(playerInfo));
                }
                const activeGame = await activeGames.get(playerKey);
                if (String(activeGame?.gameId) === game.gameId && activeGame?.platformId === game.platformId) {
                    log(`FINISHER: Game ${game.id} in progress`);
                    continue;
                }
                const matchId = addPlatformToMatchId(game.platformId, game.gameId);
                if (!matches.has(matchId)) {
                    matches.set(matchId, findPublishedMatch(game));
                }
                const match = await matches.get(matchId);
                if (!match) {
                    log(`FINISHER: Match ${matchId} not yet available from Riot`);
                    continue;
                }
                await resultGame(game, match, playerInfo);
            } catch (error) {
                log(`FINISHER: Failed to process game ${game.id}`, LoggerType.ERROR);
                log(error, LoggerType.ERROR);
            }
        }
    },
};

async function refundTimedOutGame(game: SteveGame) {
    try {
        const bets = await findRefundableBets(game.id);
        const refundResults = await Bluebird.map(bets, refundBetAndNotify, { concurrency: 5 });
        if (!refundResults.every(Boolean)) {
            log(`FINISHER: Some refunds failed for game ${game.gameId}; will retry`, LoggerType.ERROR);
            return;
        }
        await voidGame(game.id);
    } catch (error) {
        log(`FINISHER: Failed to refund game ${game.gameId}; will retry`, LoggerType.ERROR);
        log(error, LoggerType.ERROR);
    }
}

async function refundBetAndNotify(bet: Bet) {
    try {
        const refund = await refundBet(bet);
        if (refund) {
            await notifyRefund(refund, bet.steveGameId);
        }
        return true;
    } catch (error) {
        log(
            `FINISHER: Failed to refund bet ${bet.id} for user ${bet.userId} in game ${bet.steveGameId}`,
            LoggerType.ERROR,
        );
        log(error, LoggerType.ERROR);
        return false;
    }
}

async function notifyRefund(refund: Transaction, steveGameId: number) {
    try {
        await discordMessages.sendPrivateMessageToGambler(
            `Mäng on olnud pooleli üle ühe tunni. Sinu panus tühistati ja **${refund.amount}** muumimünti tagastati. Su uus kontoseis on **${refund.balance}** muumimünti.`,
            refund.userId,
        );
    } catch (error) {
        log(`FINISHER: Failed to notify ${refund.userId} of refund for game ${steveGameId}`, LoggerType.ERROR);
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
        game.id,
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
    await resultBetsBySteveGameId(game.id, {
        result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
    });
    await deleteIncompleteBets(game.id);
    const topBets = await findTopBet(game.id);
    log(
        `FINISHER: Suurimad panustajad see mäng:\n${topBets
            .map((user) => {
                return `${user.userId} ${user.amount} ${user.guess}\n`;
            })
            .toString()
            .replaceAll(',', '')} `,
    );
    await Bluebird.map(topBets, async (bet: Bet) => {
        if (bet.result === BetResult.VOID) {
            return;
        }
        try {
            await settleBet(bet, playerInfo);
        } catch (error) {
            log(
                `FINISHER: Failed to settle bet ${bet.id} for user ${bet.userId} in game ${bet.steveGameId}`,
                LoggerType.ERROR,
            );
            log(error, LoggerType.ERROR);
        }
    });
    try {
        await discordMessages.sendChannelMessage(
            `:bell: | [${RIOT_PLATFORM_LABEL[game.platformId]}] ${playerInfo.gameName} mäng lõppes. ${playerInfo.gameName} **${playerResult.win ? 'võitis' : 'kaotas'}**!`,
        );
    } catch (error) {
        log(`FINISHER: Failed to announce result for game ${game.id}`, LoggerType.ERROR);
        log(error, LoggerType.ERROR);
    }
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
    return `[${RIOT_PLATFORM_LABEL[player.platformId]}] ${player.gameName} **${playerResultMessage}** oma mängu! Sa ${betResultMessage} **${balanceChangeMessage}**, su uus kontoseis on **${balanceAmount}** muumimünti`;
}
