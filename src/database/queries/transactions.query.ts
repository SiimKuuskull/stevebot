import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Transaction } from '../models/transactions.model.ts';

export async function createTransaction(template: Partial<Transaction>, knexTrx = db) {
    const [transaction] = await knexTrx('transactions').insert(template).returning('*');
    log(`Created transaction ${transaction.id}`);
    return transaction;
}
export async function getLatestTransactions() {
    const latestTransactions = db<Transaction>('transactions').where('id', '<=', 100);
    return latestTransactions;
}
