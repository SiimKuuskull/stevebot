import { log } from '../../tools/logger';
import { db } from '../db';
import { Bet } from '../models/bet.model';
import { createUserBalance, findUserBalance } from './balance.query';
import { findInprogressGame } from './steveGames.query';

export async function placeUserBet(userName: string, userId: string, amount: number) {
    let currentUserBalance = (await findUserBalance(userName))?.amount;
    if (!currentUserBalance) {
        const balance = await createUserBalance({ userName: userName, userId: userId, amount: 100 });
        currentUserBalance = balance.amount;
    }
    if (currentUserBalance >= amount) {
        const betGameId = (await findInprogressGame()).gameId;
        await db<Bet>('bets').insert({ userId: userId, userName: userName, amount: amount, gameId: betGameId });
        const betAmount = await db<Bet>('bets').where('userId', userId).first();
        log(`New bet entered by ${userName} with ${betAmount.amount} credits. `);
        return betAmount;
    } else {
        const missingBalance =
            "You don't have enough credit to place this bet! To check your balance type '/my-balance' ";
        return missingBalance;
    }
}

export async function placeUserBetDecision(userName: string, guess: boolean) {
    await db<Bet>('bets').where({ userName: userName }).update({ guess: guess });
    const betDecision = await db<Bet>('bets').where('userName', userName).first();
    log(`Bet updated by ${userName} choosing ${betDecision.guess}`);
    return betDecision;
}

export async function findUserBetDecision(userName: string) {
    const betDecision = await db<Bet>('bets').where('userName', userName).first();
    log(`User ${userName} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}
export async function findUserBetDecisionandGameId(userName: string, gameId: number) {
    const betDecision = await db<Bet>('bets').where({ userName: userName, gameId: gameId }).first();
    log(
        `User ${userName} bet ${betDecision?.amount} on Steve ${betDecision?.guess} the game ID: ${betDecision?.gameId}`,
    );
    return betDecision;
}
export async function findUserBetDecisionByGameId(gameId: number) {
    const betDecision = await db<Bet>('bets').where({ gameId: gameId }).returning('*');
    return betDecision;
}
export async function updateUserBetDecision(gameId: number, update: Partial<Bet>) {
    await db<Bet>('bets').where('gameId', gameId).update(update);
}
export async function findTopBet(gameId: number) {
    return db<Bet>('bets').where('gameId', gameId).orderBy('amount', 'desc');
}
