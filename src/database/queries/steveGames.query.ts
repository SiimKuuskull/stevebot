import { DateTime } from 'luxon';
import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export async function createSteveGame(template: Partial<SteveGame>) {
    const beginTime = DateTime.fromISO(new Date(template.gameStart).toISOString());
    const realTime = DateTime.fromISO(new Date().toISOString());
    const { minutes: gameLengthMinutes } = realTime.diff(beginTime, 'minutes').toObject();
    console.log('test1: ', gameLengthMinutes);
    const [game] = await db<SteveGame>('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
    return game;
}

export async function findInprogressGame() {
    return db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
}
export async function findSteveGameById(currentGameId: string) {
    return db<SteveGame>('steve_games').where({ gameId: currentGameId }).first();
}
export async function updateSteveGame(gameId: string, update: Partial<SteveGame>) {
    await db<SteveGame>('steve_games').where({ gameId }).update(update);
}
