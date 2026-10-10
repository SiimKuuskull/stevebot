import { db } from '../db.ts';
import { type GameMeta } from '../models/gameMeta.model.ts';

export async function createGameMeta(template: Partial<GameMeta>) {
    const [gameMeta] = await db('game_meta').insert(template).returning('*');
    return gameMeta;
}

export async function findGameMetaBySteveGameId(steveGameId: number) {
    return db('game_meta').where({ steveGameId }).first();
}
