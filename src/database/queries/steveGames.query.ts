import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export async function createSteveGame(template: Partial<SteveGame>) {
    const [game] = await db<SteveGame>('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
}

export async function findInprogressGame() {
    return db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
}

export async function updateSteveGame(id: number, update: Partial<SteveGame>) {
    await db<SteveGame>('steve_games').where({ id }).update(update);
}

export async function getSteveGameLength() {
    const { gameStart: gameStartTime } = await findInprogressGame();
    const currentGameLength = Date.now() - gameStartTime;
    const gameLengthMinutes = (currentGameLength / 1000 / 60).toFixed(0);
    const gameLengthSeconds = Math.floor(currentGameLength / 1000) % 60;
    const formatGameLength = `${gameLengthMinutes}:${gameLengthSeconds}`;
    return formatGameLength;
}
