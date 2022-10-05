import { db } from '../db';
import { log } from '../../tools/logger';
import { Bet, BetGuess } from '../models/bet.model';
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
                currentBalance.amount - 1
            }`,
        );
    }
    await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    return newBalance;
}
export async function changeUserBalanceWinByGuess(guess: BetGuess, betAmount: number) {
    const { userName, userId } = await db<Bet>('bets').where('guess', guess).first();
    const currentBalance = await db<Balance>('balance').where('userName', userName).first();
    const betOdds = (await db<Bet>('bets').where('userName', userName).first()).odds;
    if (currentBalance.penalty !== 0) {
        const newBalance = currentBalance.amount + betOdds * betAmount - betAmount * currentBalance.penalty;
        await db<Balance>('balance')
            .where('userName', userName)
            .update({ amount: newBalance, penalty: currentBalance.penalty - 1 });
    }
    if (currentBalance.penalty === 0) {
        const newBalance = currentBalance.amount + betOdds * betAmount;
        await db<Balance>('balance').where('userName', userName).update({ amount: newBalance });
    }
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
