import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type User } from '../models/user.model.ts';
import { createUserBalance } from './balance.query.ts';

export async function createUser(template: Partial<User>, knexTrx = db) {
    const [user] = await knexTrx('users').insert(template).returning('*');
    log(`Created user ${user.id}`);
    return user;
}

export async function findUserById(id: string) {
    return db('users').where('id', id).first();
}

export async function createBettingAccount(userId: string, userName: string) {
    return db.transaction(async (knexTrx) =>
        Promise.all([
            createUserBalance({ userId, userName }, knexTrx),
            createUser({ id: userId, name: userName }, knexTrx),
        ]),
    );
}
