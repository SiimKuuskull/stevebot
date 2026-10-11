import { db } from '../db.ts';
import { log } from '../../tools/logger.ts';
import { type Balance } from '../models/balance.model.ts';

export async function findUserBalance(userId: string) {
    return db('balance').where('userId', userId).first();
}

export async function getAllBalances() {
    return db('balance').orderBy('amount', 'desc');
}

export async function getAllCurrency() {
    const [totalAmount] = await db('balance').sum('amount');
    log(`Total balance: ${totalAmount.sum}`);
    return totalAmount;
}

export async function updateBalance(userId: string, amount: number, hasPenaltyChanged?: boolean, knexTrx = db) {
    const penaltySql = hasPenaltyChanged ? `, penalty = penalty - 0.1` : '';
    const { rows } = await knexTrx.raw(
        `UPDATE balance set amount = amount + :amount ${penaltySql} WHERE user_id = :userId RETURNING * `,
        {
            userId,
            amount,
        },
    );
    return rows[0] as Balance;
}

export async function updateBalancePenalty(userId: string) {
    await db.raw('UPDATE balance set penalty = penalty - 0.1 WHERE user_id = :userId', {
        userId,
    });
}

export async function createUserBalance(template: Partial<Balance>, knexTxn = db) {
    const [balance] = await knexTxn('balance')
        .insert({ amount: 100, ...template })
        .returning('*');

    log(`Created a new betting account for ${balance.userName} with ${balance.amount} starting credit. `);
    return balance;
}

export async function getExistingPenalty(userId: string) {
    const balance = await findUserBalance(userId);
    return balance?.penalty;
}
export async function getBankruptcyCount(userId: string) {
    const balance = await findUserBalance(userId);
    return balance?.bankruptcy;
}

export async function declareBalanceBankruptcy(userId: string, count: number) {
    const [balance] = await db('balance')
        .where({ userId })
        .update({ bankruptcy: count, penalty: (count + 1) / 10 })
        .returning('*');
    return balance;
}

export async function updateLateLoanBalance(userId: string) {
    const balance = await db('balance').where('userId', userId).first();
    if (!balance) {
        throw new Error(`Could not find balance for user ${userId}`);
    }
    log(`Adding a penalty to ${balance.userName}`);
    return await db('balance')
        .where('userId', userId)
        .update({ penalty: balance.penalty + 0.3 });
}
export async function getAllBalancesCount() {
    const [{ count }] = await db('balance').count();
    return count;
}

export async function findAllUserBalances() {
    const allUserBalances = db<Balance>('balance').where('id');
    return allUserBalances;
}
