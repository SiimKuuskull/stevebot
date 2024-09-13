import { db } from '../database/db';
import { TransactionType } from '../database/models/transactions.model';
import { createUserBalance, findUserBalance } from '../database/queries/balance.query';
import { createUser, findUserById } from '../database/queries/users.query';
import { makeTransaction } from './transaction.service';

export async function useBettingAccount({ id, tag }: { id: string; tag: string }) {
    let isNewUser = false;
    let [user, balance] = await Promise.all([findUserById(id), findUserBalance(id)]);
    if (!user) {
        [balance, user] = await createBettingAccount(id, tag);
        isNewUser = true;
    }
    return { balance, user, isNewUser };
}

async function createBettingAccount(userId: string, userName: string) {
    const response = await db.transaction(async (knextrx) => {
        const response = await Promise.all([
            createUserBalance({ userId, userName }, knextrx),
            createUser({ id: userId, name: userName }, knextrx),
        ]);
        return response;
    });
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
