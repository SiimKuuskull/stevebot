import { log } from '../../tools/logger';
import { db } from '../db';
import { Player } from '../models/player.model';

export async function addPlayer(template: Partial<Player>) {
    const [player] = await db('player').insert(template).returning('*');
    log(`Added player ${player.gameName}#${player.tagLine}`);
    return player;
}

export function findTrackedPlayer() {
    const player = db('player').where({ isTracked: true }).first();
    return player;
}
export async function unTrackAll() {
    await db('player').delete();
}
