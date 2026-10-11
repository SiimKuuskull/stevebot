import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Transaction, TransactionType } from '../models/transactions.model.ts';
import { updateBalance } from './balance.query.ts';

export async function createTransaction(template: Partial<Transaction>, knexTrx = db) {
    const [transaction] = await knexTrx('transactions').insert(template).returning('*');
    log(`Created transaction ${transaction.id}`);
    return transaction;
}
export async function getLatestTransactions() {
    const latestTransactions = db<Transaction>('transactions').where('id', '<=', 100);
    return latestTransactions;
}

export function createTransactionWithBalance(template: TransactionInput, options?: TransactionOptions) {
    return db.transaction(async (knexTrx) => {
        let balanceAmount = template.amount;
        if (template.type !== TransactionType.BALANCE_CREATED) {
            const balance = await updateBalance(template.userId, template.amount, options?.hasPenaltyChanged, knexTrx);
            if (balance.amount < 0) {
                throw new Error('Not enough coins');
            }
            balanceAmount = balance.amount;
        }

        return createTransaction({ ...template, balance: balanceAmount }, knexTrx);
    });
}

type RequiredTransactionFieds = Pick<Transaction, 'amount' | 'type' | 'userId'>;
type OptionalTransactionFields = Omit<Partial<Transaction>, 'amount' | 'type' | 'userId'>;

export type TransactionInput = OptionalTransactionFields & RequiredTransactionFieds;

type TransactionOptions = {
    hasPenaltyChanged: boolean;
};
