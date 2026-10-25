import { type Knex } from 'knex';
import { DateTime } from 'luxon';
import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { BetResult } from '../models/bet.model.ts';
import { type SteveGame, SteveGameStatus } from '../models/steveGame.model.ts';
import { refundableBetsQuery } from './bets.query.ts';

export async function createSteveGame(template: Partial<SteveGame> & { playerId: number }) {
    if (template.playerId == null) {
        throw new Error('A player ID is required to create a game');
    }
    const [game] = await db('steve_games').insert(template).returning('*');
    log(
        `Created steve game ${game.id} for game ID ${game.gameId}, platform ${game.platformId} assigned to player ID ${game.playerId}`,
    );
    return game;
}

export async function findInprogressGame() {
    return db('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).orderBy('createdAt', 'desc').first();
}
export async function findInprogressGames() {
    return db('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS });
}
export async function findSteveGameById(steveGameId: number) {
    return db('steve_games').where({ id: steveGameId }).first();
}

export async function findSteveGameByMatch(match: Pick<SteveGame, 'platformId' | 'gameId'> & { playerId: number }) {
    return db('steve_games').where(match).first();
}

export function findSteveGames() {
    return db('steve_games');
}

export async function updateSteveGame(
    steveGameId: number,
    update: Partial<SteveGame>,
    expectedStatus?: SteveGameStatus,
) {
    const query = db('steve_games').where({ id: steveGameId });
    if (expectedStatus) {
        query.where({ gameStatus: expectedStatus });
    }
    return query.update(update);
}

export async function lockInProgressGame(steveGameId: number, knexTrx: Knex.Transaction) {
    return knexTrx('steve_games')
        .where({ id: steveGameId, gameStatus: SteveGameStatus.IN_PROGRESS })
        .first()
        .forShare();
}

export async function findTodaysSteveGames() {
    return db('steve_games').where('gameStart', `>`, DateTime.now().minus({ days: 1 }).toMillis());
}

export async function getLastSeenPlayer(): Promise<number> {
    const lastSeenEpochQuery = await db.raw(
        'SELECT GREATEST(game_start, game_end) FROM steve_games ORDER BY greatest DESC ',
    );
    const lastSeenEpoch = lastSeenEpochQuery.rows[0].greatest;
    return lastSeenEpoch;
}

export async function voidGame(steveGameId: number) {
    return db.transaction(async (knexTrx) => {
        const updated = await knexTrx('steve_games')
            .where({ id: steveGameId, gameStatus: SteveGameStatus.IN_PROGRESS })
            .whereNotExists(refundableBetsQuery(steveGameId))
            .update({ gameStatus: SteveGameStatus.VOID });
        if (updated) {
            await knexTrx('bets')
                .where({ steveGameId, guess: BetResult.IN_PROGRESS, result: BetResult.IN_PROGRESS })
                .del();
        }
    });
}
