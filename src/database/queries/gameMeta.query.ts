import { db } from '../db';
import { GameMeta } from '../models/gameMeta.model';

export async function createGameMeta(template: Partial<GameMeta>) {
    const [gameMeta] = await db<GameMeta>('game_meta').insert(template).returning('*');
    return gameMeta;
}

export async function findGameMetaBySteveGameId(steveGameId: number) {
    return db<GameMeta>('game_meta').where({ steveGameId }).first();
}
