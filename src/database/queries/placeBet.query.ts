import { log } from '../../tools/logger';
import { db } from '../db';
import { Bet } from '../models/bet.model';
import { createUserBalance, findUserBalance } from './balance.query';
import { findInprogressGame } from './steveGames.query';

export async function placeUserBet(userId: string, amount: number) {
    let currentUserBalance = (await findUserBalance(userId))?.amount;
    if (!currentUserBalance) {
        const balance = await createUserBalance({ userId: userId, amount: 100 });
        currentUserBalance = balance.amount;
    }
    if (currentUserBalance > amount) {
        await db<Bet>('bets').insert({ userId: userId, amount: amount, gameId: (await findInprogressGame())?.id });
        const betAmount = await db<Bet>('bets').where('userId', userId).first();
        log(`New bet entered by ${userId} with ${betAmount.amount} credits. `);
        return betAmount;
    } else {
        const missingBalance =
            "You don't have enough credit to place this bet! To check your balance type '/my-balance' ";
        return missingBalance;
    }
}

export async function placeUserBetDecision(userId: string, guess: string) {
    await db<Bet>('bets').where({ userId: userId }).update({ guess: guess });
    const betDecision = await db<Bet>('bets').where('userId', userId).first();
    log(`Bet updated by ${userId} choosing ${betDecision.guess}`);
    return betDecision;
}

export async function findUserBetDecision(userId: string) {
    const betDecision = await db<Bet>('bets').where('userId', userId).first();
    log(`User ${userId} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}
