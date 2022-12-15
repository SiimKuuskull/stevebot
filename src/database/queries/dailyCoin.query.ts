import { log } from '../../tools/logger';
import { db } from '../db';
import { DailyCoin } from '../models/dailyCoin.model';

export async function createDailyCoin(template: Partial<DailyCoin>) {
    const [dailyCoin] = await db<DailyCoin>('daily_coin').insert(template).returning('*');
    log(`Gave daily coin ${dailyCoin.id} to ${dailyCoin.userId}`);
    return dailyCoin;
}

export async function findLatestUserDailyCoin(userId: string) {
    return db<DailyCoin>('daily_coin').where('userId', userId).orderBy('createdAt', 'desc').first();
}

export async function updateDailyCoin(id: number, update: Partial<DailyCoin>) {
    await db<DailyCoin>('daily_coin').where('id', id).update(update);
}
