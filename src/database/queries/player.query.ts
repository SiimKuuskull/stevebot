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

export async function setSingleTrackedPlayer({
    puuid,
    gameName,
    tagLine,
    platformId,
}: Pick<Player, 'puuid' | 'gameName' | 'tagLine' | 'platformId'>) {
    const player = await db.transaction(async (trx) => {
        await trx('player').where({ isTracked: true }).update({ isTracked: false, updatedAt: trx.fn.now() });
        const trackedPlayer = { puuid, gameName, tagLine, platformId, isTracked: true };
        const [player] = await trx('player')
            .insert(trackedPlayer)
            .onConflict('puuid')
            .merge({ ...trackedPlayer, updatedAt: trx.fn.now() })
            .returning('*');
        return player;
    });
    log(`Tracking player ${player.gameName}#${player.tagLine}`);
    return player;
}
