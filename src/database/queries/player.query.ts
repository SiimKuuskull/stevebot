import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { MAX_TRACKED_PLAYERS, type Player } from '../models/player.model.ts';

export async function addPlayer(template: Partial<Player>) {
    const [player] = await db('player').insert(template).returning('*');
    log(`Added player ${player.gameName}#${player.tagLine}`);
    return player;
}

export function findTrackedPlayers() {
    const players = db('player').where({ isTracked: true });
    return players;
}

export function findPlayerById(playerId: number) {
    const player = db('player').where({ id: playerId }).first();
    return player;
}

export async function activatePlayerTracking(profile: Pick<Player, 'puuid' | 'gameName' | 'tagLine' | 'platformId'>) {
    return db.transaction(async (trx) => {
        await trx.raw('LOCK TABLE player IN SHARE ROW EXCLUSIVE MODE');
        const existing = await trx('player').where({ puuid: profile.puuid }).first();
        if (!existing?.isTracked) {
            const count = await trx('player')
                .where({ isTracked: true })
                .count<{ count: string }>('id as count')
                .first();
            if (Number(count?.count) >= MAX_TRACKED_PLAYERS) {
                return;
            }
        }
        const values = { ...profile, isTracked: true, updatedAt: trx.fn.now() };
        const [player] = existing
            ? await trx('player').where({ id: existing.id }).update(values).returning('*')
            : await trx('player').insert(values).returning('*');
        const status = !existing ? 'added' : existing.isTracked ? 'updated' : 'reactivated';
        return { player, status };
    });
}

export async function deactivatePlayerTracking(playerId: number) {
    const [player] = await db('player')
        .where({ id: playerId, isTracked: true })
        .update({ isTracked: false, updatedAt: db.fn.now() })
        .returning('*');
    return player;
}

export async function hasPlayers() {
    return Boolean(await db('player').select('id').first());
}

export function createInitialTrackedPlayer(template: Pick<Player, 'puuid' | 'gameName' | 'tagLine' | 'platformId'>) {
    return db.transaction(async (trx) => {
        await trx.raw('LOCK TABLE player IN SHARE ROW EXCLUSIVE MODE');
        if (await trx('player').select('id').first()) {
            return;
        }
        const [player] = await trx('player')
            .insert({ ...template, isTracked: true })
            .returning('*');
        log(`Tracking initial player ${player.gameName}#${player.tagLine}`);
        return player;
    });
}
