import { Balance } from '../database/models/balance.model';
import { TransactionType } from '../database/models/transactions.model';
import { declareBalanceBankruptcy } from '../database/queries/balance.query';
import { wipeUserLoans } from '../database/queries/loans.query';
import { makeTransaction } from './transaction.service';

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
