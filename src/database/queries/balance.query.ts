import { db } from '../db';
import { log } from '../../tools/logger';
import { Bet } from '../models/bet.model';
import { Balance } from '../models/balance.model';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
}

export async function changeUserBalanceHoldLose(userName: string, betAmount: number) {
    const currentBalance = await db<Balance>('balance').where('userName', userName).first();
    const newBalance = currentBalance.amount - betAmount;
    if (currentBalance.penalty !== 0) {
        await db<Balance>('balance')
            .where('userName', userName)
            .update({ amount: newBalance, penalty: currentBalance.penalty - 1 });
        log(
            `${currentBalance.userName} balance changed by ${newBalance}. Penalised games left: ${
                currentBalance.penalty - 1
            }`,
        );
    }
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWinByGuess(betAmount: number, gameId: string) {
    const [bet] = await db<Bet>('bets').where('gameId', gameId);
    const [currentBalance] = await db<Balance>('balance').where('userName', bet.userName);
    if (currentBalance.penalty !== 0) {
        const newBalance = currentBalance.amount + bet.odds * betAmount - betAmount * currentBalance.penalty;
        await db<Balance>('balance')
            .where('userName', currentBalance.userName)
            .update({ amount: newBalance, penalty: currentBalance.penalty - 0.1 });
    }
    if (currentBalance.penalty === 0) {
        const newBalance = currentBalance.amount + bet.odds * betAmount;
        await db<Balance>('balance').where('userName', currentBalance.userName).update({ amount: newBalance });
    }
    const updatedBalance = await findUserBalance(currentBalance.userId);
    return updatedBalance;
}

export async function createUserBalance(template: Partial<Balance>) {
    const [balance] = await db<Balance>('balance')
        .insert({ amount: 100, ...template })
        .returning('*');
    log(`Created a new betting account for ${balance.userName} with ${balance.amount} starting credit. `);
    return balance;
}

export async function getBetUsername(userName: string) {
    const user = await db<Balance>('balance').where('userName', userName).first();
    return user.userId;
}
export async function getExistingPenalty(userId: string) {
    const { penalty: existingPenalty } = await findUserBalance(userId);
    return existingPenalty;
}
export async function getBankruptcyCount(userId: string) {
    const { bankruptcy: bankruptCount } = await findUserBalance(userId);
    return bankruptCount;
}
export async function updateBrokeUserBalance(userId: string) {
    const bankruptCount = await getBankruptcyCount(userId);
    await db<Balance>('balance')
        .where('userId', userId)
        .update({ amount: 100, bankruptcy: bankruptCount + 1, penalty: (bankruptCount + 1) / 10 });
    const [newBalance] = await db<Balance>('balance').where('userId', userId);
    log(
        `${newBalance.userName} reset their balance to ${newBalance.amount} moomincoins, this is their ${newBalance.bankruptcy}. bankruptcy. Penalty for the next 5 games: ${newBalance.penalty} `,
    );
    return newBalance;
}
export async function updateUserLoanBalance(userId: string, amount: number) {
    const [balance] = await db<Balance>('balance').where('userId', userId);
    await db<Balance>('balance')
        .where('userId', userId)
        .update({ amount: balance.amount + amount });
    log(`${balance.userName} balance updated. New balance is ${balance.amount + amount}`);
    return balance;
}

export async function updateLateLoanBalance(userId: string) {
    const [balance] = await db<Balance>('balance').where('userId', userId);
    log(`Adding a penalty to ${balance.userName}`);
    return await db<Balance>('balance')
        .where('userId', userId)
        .update({ penalty: balance.penalty + 0.3 });
}
