import { log } from '../../tools/logger';
import { db } from '../db';
import { Player } from '../models/player.model';

export async function addPlayer(template: Partial<Player>) {
    const [player] = await db<Player>('player').insert(template).returning('*');
    log(`Added player ${player.name}`);
    return player;
}

export function findTrackedPlayer() {
    const player = db<Player>('player').where({ isTracked: true }).first();
    return player;
}
