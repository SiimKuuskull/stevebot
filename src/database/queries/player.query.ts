import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Player } from '../models/player.model.ts';

export async function addPlayer(template: Partial<Player>) {
    const [player] = await db('player').insert(template).returning('*');
    log(`Added player ${player.gameName}#${player.tagLine}`);
    return player;
}

export function findTrackedPlayer() {
    const player = db('player').where({ isTracked: true }).first();
    return player;
}
export async function findPlayers(): Promise<Player[]> {
    return db('player');
}
export async function unTrackAll() {
    await db('player').delete();
}
