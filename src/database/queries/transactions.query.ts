import { Knex } from 'knex';
import { log } from '../../tools/logger';
import { db } from '../db';
import { Transaction } from '../models/transactions.model';

export async function createTransaction(template: Partial<Transaction>, knexTrx?: Knex.Transaction) {
    let transaction: Transaction;
    if (knexTrx) {
        const response = await knexTrx<Transaction>('transactions').insert(template).returning('*');
        transaction = response[0];
    } else {
        const response = await db<Transaction>('transactions').insert(template).returning('*');
        transaction = response[0];
    }
    log(`Created transaction ${transaction.id}`);
    return transaction;
}
