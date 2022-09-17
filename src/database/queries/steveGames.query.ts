import { getActivegameBySummonerId } from '../../services/riot-games/requests';
import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';
import { findTrackedPlayer } from './player.query';

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

export async function updateSteveGameLength() {
    const playerId = (await findTrackedPlayer()).id;
    const activeSteveGame = await getActivegameBySummonerId(playerId);
    const currentGameLength = activeSteveGame.gameLength;
    await db<SteveGame>('steve_games')
        .where({ gameStatus: SteveGameStatus.IN_PROGRESS })
        .update({ gameLength: currentGameLength });
    return currentGameLength;
}
