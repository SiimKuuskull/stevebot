import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export async function createSteveGame(template: Partial<SteveGame>) {
    const [game] = await db<SteveGame>('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
    return game;
}

export async function findInprogressGame() {
    return db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
}
export async function findSteveGameId(currentGameId: string) {
    return db<SteveGame>('steve_games').where({ gameId: currentGameId }).first();
}
export async function updateSteveGame(gameId: string, update: Partial<SteveGame>) {
    await db<SteveGame>('steve_games').where({ gameId }).update(update);
}

export async function getSteveGameLength() {
    const { gameStart: gameStartTime } = await findInprogressGame();
    const currentGameLength = Math.floor(Number(Date.now() - gameStartTime) / 1000 / 60);
    return currentGameLength;
}

export async function getFormattedSteveGameLength() {
    const { gameStart: gameStartTime } = await findInprogressGame();
    const currentGameLength = Date.now() - gameStartTime;
    const gameLengthMinutes = Math.floor(currentGameLength / 1000 / 60);
    const gameLengthSeconds = Math.floor(currentGameLength / 1000) % 60;
    const formatGameLength = `${gameLengthMinutes < 10 ? '0' + gameLengthMinutes : gameLengthMinutes}:${
        gameLengthSeconds < 10 ? '0' + gameLengthSeconds : gameLengthSeconds
    }`;
    return formatGameLength;
}
