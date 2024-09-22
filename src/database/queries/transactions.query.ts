import { log } from '../../tools/logger';
import { db } from '../db';
import { Transaction } from '../models/transactions.model';

export async function createTransaction(template: Partial<Transaction>, knexTrx = db) {
    const [transaction] = await knexTrx('transactions').insert(template).returning('*');
    log(`Created transaction ${transaction.id}`);
    return transaction;
}
export async function getLatestTransactions() {
    const latestTransactions = db<Transaction>('transactions').where('id', '<=', 100);
    return latestTransactions;
}
