import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type User } from '../models/user.model.ts';

export async function createUser(template: Partial<User>, knexTrx = db) {
    const [user] = await knexTrx('users').insert(template).returning('*');
    log(`Created user ${user.id}`);
    return user;
}

export async function findUserById(id: string) {
    return db('users').where('id', id).first();
}
