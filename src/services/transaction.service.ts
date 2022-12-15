import { db } from '../database/db';
import { Transaction } from '../database/models/transactions.model';
import { updateBalance } from '../database/queries/balance.query';
import { createTransaction } from '../database/queries/transactions.query';

export function makeTransaction(template: Partial<Transaction>, { hasPenaltyChanged }: TransactionOptions) {
    return db.transaction(async (knexTrx) => {
        const balance = await updateBalance(template.userId, template.amount, hasPenaltyChanged, knexTrx);
        const transaction = await createTransaction({ ...template, balance: balance.amount }, knexTrx);
        return transaction;
    });
}

type TransactionOptions = {
    hasPenaltyChanged: boolean;
};
