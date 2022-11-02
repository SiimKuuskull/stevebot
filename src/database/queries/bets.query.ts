import { log } from '../../tools/logger';
import { db } from '../db';
import { Bet, BetGuess, BetResult } from '../models/bet.model';

export async function createBet(template: Partial<Bet>) {
    const [bet] = await db<Bet>('bets').insert(template).returning('*');
    log(`Created bet ${bet.id}`);
    return bet;
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
export async function findUserExistingBet(userName: string, gameId: string) {
    const bet = await db<Bet>('bets').where({ userName, gameId }).first();
    if (bet) {
        log(`User ${userName} bet ${bet?.amount} on Steve ${bet?.guess} the game ID: ${bet?.gameId}`);
    }
    return bet;
}
export async function findUserBetDecisionByGameId(gameId: string) {
    return db<Bet>('bets').where({ gameId });
}
export async function findTopBet(gameId: string) {
    return db<Bet>('bets').where('gameId', gameId).orderBy('amount', 'desc');
}
export async function findUserInProgressBet(userId: string) {
    return db<Bet>('bets').where({ userId, result: BetResult.IN_PROGRESS }).first();
}
export async function deleteinProgressBet(userId: string, guess: BetGuess) {
    log('Deleted a IN PROGRESS bet ');
    return db<Bet>('bets').where({ userId, guess: guess }).del();
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
