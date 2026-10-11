import { Balance } from '../database/models/balance.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { User } from '../database/models/user.model.ts';
import { findUserBalance } from '../database/queries/balance.query.ts';
import { createBettingAccount as insertBettingAccount, findUserById } from '../database/queries/users.query.ts';
import { makeTransaction } from './transaction.service.ts';

export async function useBettingAccount({ id, tag }: { id: string; tag: string }) {
    let isNewUser = false;
    let [user, balance] = await Promise.all([findUserById(id), findUserBalance(id)]);
    if (!user) {
        [balance, user] = await createBettingAccount(id, tag);
        isNewUser = true;
    }
    return { balance, user, isNewUser } as { balance: Balance; user: User; isNewUser: boolean };
}

async function createBettingAccount(userId: string, userName: string) {
    const response = await insertBettingAccount(userId, userName);
    await makeTransaction(
        {
            amount: 100,
            externalTransactionId: response[0].id,
            type: TransactionType.BALANCE_CREATED,
            userId: response[0].userId,
        },
        { hasPenaltyChanged: false },
    );
    return response;
}
