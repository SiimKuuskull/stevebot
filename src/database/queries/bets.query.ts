import { getActiveLeagueGameStart } from '../../services/game.service';
import { InteractionError } from '../../tools/errors';
import { log } from '../../tools/logger';
import { db } from '../db';
import { Bet, BetGuess, BetResult } from '../models/bet.model';
import { createUserBalance, findUserBalance } from './balance.query';
import { findInprogressGame, getSteveGameLength } from './steveGames.query';

export async function createBet(template: Partial<Bet>) {
    const [bet] = await db<Bet>('bets').insert(template).returning('*');
    log(`Created bet ${bet.id}`);
    return bet;
}

export async function placeUserBet(userName: string, userId: string, amount: number) {
    let balance = await findUserBalance(userId);
    if (!balance) {
        balance = await createUserBalance({ userName, userId });
    }
    if (balance.amount >= amount) {
        const betGameId = (await findInprogressGame()).gameId;
        const betOdds = await changeBetOddsValue();
        const gameStartTime = await getActiveLeagueGameStart();
        return await createBet({
            userId: userId,
            userName: userName,
            amount: amount,
            gameId: betGameId,
            odds: betOdds,
            gameStart: gameStartTime,
            guess: BetGuess.IN_PROGRESS,
            result: BetResult.IN_PROGRESS,
        });
    } else {
        throw new InteractionError(
            `Sul pole piisavalt plege selle panuse jaoks! Sul on hetkel ${balance.amount} muumimünti `,
        );
    }
}

export async function placeUserBetDecision(userName: string, guess: BetGuess) {
    await db<Bet>('bets').where({ userName }).update({ guess });
    const betDecision = await db<Bet>('bets').where('userName', userName).first();
    log(`Bet updated by ${userName} choosing ${betDecision.guess}`);
    return betDecision;
}
export async function updateUserBetDecision(gameId: string, update: Partial<Bet>) {
    await db<Bet>('bets').where('gameId', gameId).update(update);
}

export async function findUserBetDecision(userName: string) {
    const betDecision = await db<Bet>('bets').where('userName', userName).first();
    log(`User ${userName} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}
export async function findUserBetDecisionandGameId(userName: string, gameId: string) {
    const bet = await db<Bet>('bets').where({ userName, gameId }).first();
    if (bet) {
        log(`User ${userName} bet ${bet?.amount} on Steve ${bet?.guess} the game ID: ${bet?.gameId}`);
    }
    return bet;
}
export async function findUserBetDecisionByGameId(gameId: string) {
    const betDecision = await db<Bet>('bets').where({ gameId }).returning('*');
    return betDecision;
}
export async function findTopBet(gameId: string) {
    return db<Bet>('bets').where('gameId', gameId).orderBy('amount', 'desc');
}
export async function findUserActiveBet(userId: string) {
    return db<Bet>('bets').where({ userId, result: BetResult.IN_PROGRESS }).first();
}
export async function deleteinProgressBet(userId: string, gameId: string) {
    log('Deleted a IN PROGRESS bet ');
    return db<Bet>('bets').where({ userId, gameId }).del();
}
export async function findActiveGameBets(activeGameId) {
    const activeBets = await db<Bet>('bets').where('gameId', activeGameId).returning('*');
    if (!activeBets) {
        log(`No active bets for the game: ${activeGameId} `);
        return;
    }
    return activeBets;
}

export async function changeBetOddsValue() {
    const currentGameLength = await getSteveGameLength();
    log(currentGameLength);
    let betOdds = 2;
    if (currentGameLength <= 8) {
        betOdds = 2;
    }
    if (currentGameLength <= 12) {
        betOdds = 1.6;
    } else if (currentGameLength < 20) {
        betOdds = 1.4;
    } else if (currentGameLength >= 20) {
        betOdds = 1.1;
    } else {
        return betOdds;
    }
    return betOdds;
}
