import { type Balance } from '../database/models/balance.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { declareBalanceBankruptcy } from '../database/queries/balance.query.ts';
import { wipeUserLoans } from '../database/queries/loans.query.ts';
import { makeTransaction } from './transaction.service.ts';

export async function goBankrupt(balance: Balance) {
    await makeTransaction({
        amount: 100 - balance.amount,
        externalTransactionId: balance.id,
        type: TransactionType.BANKRUPTCY,
        userId: balance.userId,
    });
    const [bankruptBalance] = await Promise.all([
        declareBalanceBankruptcy(balance.userId, balance.bankruptcy + 1),
        wipeUserLoans(balance.userId),
    ]);
    return bankruptBalance;
}
