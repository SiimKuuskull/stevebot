import { db } from '../database/db';
import { Balance } from '../database/models/balance.model';
import { Transaction, TransactionType } from '../database/models/transactions.model';
import { updateBalance } from '../database/queries/balance.query';
import { createTransaction } from '../database/queries/transactions.query';

export function makeTransaction(template: Partial<Transaction>, options?: TransactionOptions) {
    return db.transaction(async (knexTrx) => {
        let balance: Balance;
        if (template.type !== TransactionType.BALANCE_CREATED) {
            balance = await updateBalance(template.userId, template.amount, options?.hasPenaltyChanged, knexTrx);
            if (balance.amount < 0) {
                throw new Error('Not enough coins');
            }
        }

        const transaction = await createTransaction(
            { ...template, balance: balance?.amount ?? template.amount },
            knexTrx,
        );
        return transaction;
    });
}

type TransactionOptions = {
    hasPenaltyChanged: boolean;
};
