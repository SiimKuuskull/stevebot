import { getLatestUserMatchIds } from '../../services/riot-games/requests';
import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export async function createSteveGame(template: Partial<SteveGame>) {
    const [game] = await db<SteveGame>('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
}

export async function findExistingActiveGame() {
    return db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
}

export async function findInprogressGame() {
    const game = await db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
    if (game) {
        log(`Found in progress game:  ${game?.gameId}`);
    }
    return game;
}

export async function updateSteveGame(id: number, update: Partial<SteveGame>) {
    await db<SteveGame>('steve_games').where({ id }).update(update);
}

export async function findLastSteveGame(playerInfo) {
    const lastSteveGames = await getLatestUserMatchIds(playerInfo);
    const lastSteveGame = lastSteveGames[0];
    return lastSteveGame;
}
