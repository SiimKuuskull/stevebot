import { Balance } from '../models/balance.model';
import { db } from '../db';
import { log } from '../../tools/logger';
import { Bet } from '../models/bet.model';

export async function findUserBalance(userName: string) {
    return db<Balance>('balance').where('userName', userName).first();
}

export async function changeUserBalanceHoldLose(userName: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userName', userName).first()).amount;
    const newBalance = currentBalance - betAmount;
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWin(userName: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userName', userName).first()).amount;
    const newBalance = currentBalance + betAmount;
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWinByGuess(guess: boolean, betAmount: number) {
    const betUserId = (await db<Bet>('bets').where('guess', guess).first()).userId;
    const currentBalance = (await db<Balance>('balance').where('userName', betUserId).first()).amount;
    const newBalance = currentBalance + 2 * betAmount;
    await db<Balance>('balance').where('userName', betUserId).update({ amount: newBalance });
    const updatedBalance = await findUserBalance(betUserId);
    return updatedBalance;
}

export async function createUserBalance(template: Partial<Balance>) {
    const [balance] = await db<Balance>('balance').insert(template).returning('*');
    await db<Balance>('balance').update({ amount: 100 });
    log(`Created a new betting account for ${balance.userName} with ${balance.amount} starting credit. `);
    return balance;
}

export async function getBetUserId(userName: string) {
    const user = await db<Balance>('balance').where('userName', userName).first();
    return user.userId;
}
