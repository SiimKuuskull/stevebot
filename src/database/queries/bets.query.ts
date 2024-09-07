import { log } from '../../tools/logger';
import { db } from '../db';
import { Bet, BetResult } from '../models/bet.model';

export async function createBet(template: Partial<Bet>) {
    const [bet] = await db<Bet>('bets').insert(template).returning('*');
    log(`Created bet ${bet.id}`);
    return bet;
}
export async function updateBetAmount(userId: string, amount: number, gameId: string, odds: number) {
    const bet = await db<Bet>('bets').where({ userId, gameId }).update({ amount, odds }).returning('*');
    log(bet);
    return bet;
}

export async function placeUserBetDecision(userId: string, guess: BetResult, gameId: string) {
    await db<Bet>('bets').where({ userId, gameId }).update({ guess });
    const betDecision = await db<Bet>('bets').where({ userId, gameId }).first();
    log(`Bet updated by ${userId} choosing ${betDecision.guess}`);
    return betDecision;
}
export async function resultBetsByGameId(gameId: string, update: Partial<Bet>) {
    await db<Bet>('bets').where('gameId', gameId).update(update);
}

export async function findUserBetDecision(userId: string, gameId: string) {
    const [betDecision] = await db<Bet>('bets').where({ userId, gameId });
    log(`User ${userId} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}

export async function findUserExistingBet(userId: string, gameId: string) {
    const bet = await db<Bet>('bets').where({ userId, gameId }).first();
    if (bet) {
        log(`User ${userId} bet ${bet?.amount} on Steve ${bet?.guess} the game ID: ${bet?.gameId}`);
    }
    return bet;
}

export async function findUserBetOdds(userId: string, gameId: string) {
    const [bet] = await db<Bet>('bets').where({ userId, gameId });
    return bet?.odds;
}

export async function findTopBet(gameId: string) {
    return db<Bet>('bets').where('gameId', gameId).orderBy('amount', 'desc');
}

export async function findUserInProgressBet(userId: string) {
    return db<Bet>('bets').where({ userId, result: BetResult.IN_PROGRESS }).first();
}
export async function findInProgressGuess(userId: string) {
    return db<Bet>('bets').where({ userId, guess: BetResult.IN_PROGRESS }).first();
}

export async function deleteinProgressBet(userId: string, guess: BetResult) {
    log('Deleted a IN PROGRESS bet ');
    return db<Bet>('bets').where({ userId, guess }).del();
}

export async function deleteinProgressBetbyGameId(userId: string, gameId: string) {
    log('Deleted a IN PROGRESS bet ');
    return db<Bet>('bets').where({ userId, gameId }).del();
}

export async function findActiveGameBets(activeGameId) {
    const activeBets = await db<Bet>('bets').where('gameId', activeGameId);
    if (!activeBets.length) {
        log(`No active bets for the game: ${activeGameId} `);
        return;
    }
    return activeBets;
}

export async function deleteIncompleteBets(gameId: string) {
    log('Deleting incomplete bets');
    return db<Bet>('bets').where({ gameId, guess: BetResult.IN_PROGRESS }).del();
}

export async function updateBet(id: number, update: Partial<Bet>) {
    await db<Bet>('bets').where('id', id).update(update);
}

export async function getAllResultedBets() {
    return db<Bet>('bets')
        .whereNot({ guess: BetResult.IN_PROGRESS, result: BetResult.IN_PROGRESS })
        .returning(['userId, amount, guess, result']);
}

export async function getUserBets(userId) {
    const bets = await db<Bet>('bets').select().where('userId', userId).andWhereNot({ result: BetResult.IN_PROGRESS });
    return bets;
}
