import { db } from '../db.ts';
import { type GameMeta } from '../models/gameMeta.model.ts';

export async function createGameMeta(template: Partial<GameMeta>, knexTrx = db) {
    const [gameMeta] = await knexTrx('game_meta').insert(template).returning('*');
    return gameMeta;
}
