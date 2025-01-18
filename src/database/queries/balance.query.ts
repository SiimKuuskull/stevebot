import { db } from '../db';
import { log } from '../../tools/logger';
import { Balance } from '../models/balance.model';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
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

export async function updateBalancePenalty(userId: string, hasPenaltyChanged: boolean) {
    if (!hasPenaltyChanged) {
        return db('balance').where({ userId }).first();
    }
    const { rows } = await db.raw('UPDATE balance set penalty = penalty - 0.1 WHERE user_id = :userId RETURNING *', {
        userId,
    });
    return rows[0] as Balance;
}

export async function createUserBalance(template: Partial<Balance>, knexTxn = db) {
    const [balance] = await knexTxn('balance')
        .insert({ amount: 100, ...template })
        .returning('*');

    log(`Created a new betting account for ${balance.userName} with ${balance.amount} starting credit. `);
    return balance;
}

export async function getExistingPenalty(userId: string) {
    const { penalty: existingPenalty } = await findUserBalance(userId);
    return existingPenalty;
}
export async function getBankruptcyCount(userId: string) {
    const { bankruptcy: bankruptCount } = await findUserBalance(userId);
    return bankruptCount;
}

export async function declareBalanceBankruptcy(userId: string, count: number) {
    const [balance] = await db('balance')
        .where({ userId })
        .update({ bankruptcy: count, penalty: (count + 1) / 10 })
        .returning('*');
    return balance;
}

export async function updateLateLoanBalance(userId: string) {
    const [balance] = await db('balance').where('userId', userId);
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
