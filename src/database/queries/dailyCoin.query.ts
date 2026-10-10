import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type DailyCoin } from '../models/dailyCoin.model.ts';

export async function createDailyCoin(template: Partial<DailyCoin>) {
    const [dailyCoin] = await db('daily_coin').insert(template).returning('*');
    log(`Gave daily coin ${dailyCoin.id} to ${dailyCoin.userId}`);
    return dailyCoin;
}

export async function findLatestUserDailyCoin(userId: string) {
    return db('daily_coin').where('userId', userId).orderBy('createdAt', 'desc').first();
}

export async function updateDailyCoin(id: number, update: Partial<DailyCoin>) {
    await db('daily_coin').where('id', id).update(update);
}
