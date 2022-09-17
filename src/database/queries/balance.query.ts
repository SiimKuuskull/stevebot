import { Balance } from '../models/balance.model';
import { db } from '../db';
import { log } from '../../tools/logger';
import { Bet } from '../models/bet.model';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
}

export async function changeUserBalanceHoldLose(userName: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userName', userName).first()).amount;
    const newBalance = currentBalance - betAmount;
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWin(userName: string, betAmount: number) {
    const currentBalance = (await db<Balance>('balance').where('userName', userName).first()).amount;
    const betOdds = (await db<Bet>('bets').where('userName', userName).first()).odds;
    const newBalance = currentBalance + betOdds * betAmount;
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWinByGuess(guess: boolean, betAmount: number) {
    const { userName, userId } = await db<Bet>('bets').where('guess', guess).first();
    const currentBalance = (await db<Balance>('balance').where('userName', userName).first()).amount;
    const betOdds = (await db<Bet>('bets').where('userName', userName).first()).odds;
    const newBalance = currentBalance + betOdds * betAmount;
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    const updatedBalance = await findUserBalance(userId);
    return updatedBalance;
}

export async function createUserBalance(template: Partial<Balance>) {
    const [balance] = await db<Balance>('balance')
        .insert({ ...template, amount: 100 })
        .returning('*');
    log(`Created a new betting account for ${balance.userName} with ${balance.amount} starting credit. `);
    return balance;
}

export async function getBetUserId(userName: string) {
    const user = await db<Balance>('balance').where('userName', userName).first();
    return user.userId;
}
