import { DateTime } from 'luxon';
import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export async function createSteveGame(template: Partial<SteveGame>) {
    const [game] = await db('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
    return game;
}

export async function findInprogressGame() {
    return db('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
}
export async function findInprogressGames() {
    return db('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS });
}
export async function findSteveGameById(currentGameId: string) {
    return db('steve_games').where({ gameId: currentGameId }).first();
}

export function findSteveGames() {
    return db('steve_games');
}

export async function updateSteveGame(gameId: string, update: Partial<SteveGame>) {
    await db('steve_games').where({ gameId }).update(update);
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
