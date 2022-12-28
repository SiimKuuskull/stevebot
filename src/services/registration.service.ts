import { db } from '../database/db';
import { createUserBalance } from '../database/queries/balance.query';
import { createUser } from '../database/queries/users.query';

export function createBettingAccount(userId: string, userName: string) {
    return db.transaction(async (knextrx) => {
        return Promise.all([
            createUserBalance({ userId, userName }, knextrx),
            createUser({ id: userId, name: userName }, knextrx),
        ]);
    });
}
