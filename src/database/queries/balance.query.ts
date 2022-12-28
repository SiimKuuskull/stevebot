import { db } from '../db';
import { log } from '../../tools/logger';
import { Balance } from '../models/balance.model';
import { Knex } from 'knex';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
}

export async function updateBalance(
    userId: string,
    amount: number,
    hasPenaltyChanged: boolean,
    knexTrx: Knex.Transaction,
) {
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
        return db<Balance>('balance').where({ userId }).first();
    }
    const { rows } = await db.raw('UPDATE balance set penalty = penalty - 0.1 WHERE user_id = :userId RETURNING *', {
        userId,
    });
    return rows[0] as Balance;
}

export async function createUserBalance(template: Partial<Balance>, knexTxn?: Knex.Transaction) {
    let balance: Balance;
    if (knexTxn) {
        [balance] = await knexTxn<Balance>('balance')
            .insert({ amount: 100, ...template })
            .returning('*');
    } else {
        [balance] = await db<Balance>('balance')
            .insert({ amount: 100, ...template })
            .returning('*');
    }

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
