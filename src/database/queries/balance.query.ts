import { Balance } from '../models/balance.model';
import { db } from '../db';

export async function findUserBalance(userId: string) {
    return db<Balance>('balance').where('userId', userId).first();
}
