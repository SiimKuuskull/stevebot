import { Knex } from 'knex';
import { log } from '../../tools/logger';
import { db } from '../db';
import { User } from '../models/user.model';

export async function createUser(template: Partial<User>, knexTrx?: Knex.Transaction) {
    let user: User;
    if (knexTrx) {
        [user] = await knexTrx<User>('users').insert(template).returning('*');
    } else {
        [user] = await db<User>('users').insert(template).returning('*');
    }
    log(`Created user ${user.id}`);
    return user;
}

export async function findUserById(id: string) {
    return db<User>('users').where('id', id).first();
}
