import { log } from '../../tools/logger';
import { db } from '../db';
import { User } from '../models/user.model';

export async function createUser(template: Partial<User>, knexTrx = db) {
    const [user] = await knexTrx('users').insert(template).returning('*');
    log(`Created user ${user.id}`);
    return user;
}

export async function findUserById(id: string) {
    return db('users').where('id', id).first();
}
