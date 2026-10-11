import { createTransactionWithBalance, type TransactionInput } from '../database/queries/transactions.query.ts';

export function makeTransaction(template: TransactionInput, options?: TransactionOptions) {
    return createTransactionWithBalance(template, options);
}

type TransactionOptions = {
    hasPenaltyChanged: boolean;
};
