import { Balance } from '../models/balance.model';
import { db } from '../db';
import { log } from '../../tools/logger';
import { Bet } from '../models/bet.model';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
}

export async function changeUserBalanceHoldLose(userId: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userId', userId).first()).amount;
    const newBalance = currentBalance - betAmount;
    await db<Balance>('balance').where('userId', userId).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWin(userId: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userId', userId).first()).amount;
    const newBalance = currentBalance + betAmount;
    await db<Balance>('balance').where('userId', userId).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWinByGuess(guess: boolean, betAmount: number) {
    const betUserId = (await db<Bet>('bets').where('guess', guess).first()).userId;
    const currentBalance = (await db<Balance>('balance').where('userId', betUserId).first()).amount;
    const newBalance = currentBalance + 2 * betAmount;
    await db<Balance>('balance').where('userId', betUserId).update({ amount: newBalance });
    return newBalance;
}

export async function createUserBalance(template: Partial<Balance>) {
    const [balance] = await db<Balance>('balance').insert(template).returning('*');
    await db<Balance>('balance').update({ amount: 100 });
    log(`Created a new betting account for ${balance.userId} with ${balance.amount} starting credit. `);
    return balance;
}
