import { getLatestUserMatchIds } from '../../services/riot-games/requests';
import { log } from '../../tools/logger';
import { db } from '../db';
import { SteveGame, SteveGameStatus } from '../models/steveGame.model';

export const playerInfo = {
    id: 'S4ACAQnqkwX_ZvnuKd4rGysWSWWuVmpjchdF9Cwms-xw0x8',
    accountId: 'XA3i9g_azxRNMXtvkGzFGFS3WIkXBXJMtsLJsvH46J018FM',
    puuid: 'vDqXoxdVCabO0AH-OnGb60eh3qSq1LoLnpMIFpwXTrjAZ9OZ2Y2tUXWOYJ2dgGXnLinvG5sxmL9YXA',
    name: 'Maisike',
    profileIconId: 5413,
    revisionDate: 1662051769675,
    summonerLevel: 221,
};
export const playerInfoSiim = {
    id: 'ZLQEngL6avC1LJRbH13vXTqQVljdL-NpBkCpzoynP3GArvI',
    accountId: 'HqqK0s5L4fctjkK4YS_wzcdndJJMYj-vVLoSntY2crLV_F4',
    puuid: 'ANAIik9eZimoQKiiM-17G35Z2-_luXWS9jXIFcKk7jUOQuMo7rUwRP2FXgkt4g96Pkiio0W2MtZG9Q',
    name: 'Loviatar',
    profileIconId: 3898,
    revisionDate: 1661698038000,
    summonerLevel: 577,
};

export async function createSteveGame(template: Partial<SteveGame>) {
    const [game] = await db<SteveGame>('steve_games').insert(template).returning('*');
    log(`Created steve game ${game.id} for game ID ${game.gameId}`);
}

export async function findExistingActiveGame() {
    return db<SteveGame>('steve_games').first();
}

export async function findInprogressGame() {
    const game = await db<SteveGame>('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS }).first();
    if (game) {
        log(`Found in progress game ${game?.id}`);
    }
    return game;
}

export async function updateSteveGame(id: number, update: Partial<SteveGame>) {
    await db<SteveGame>('steve_games').where({ id }).update(update);
}

export async function findLastSteveGame() {
    const lastSteveGames = await getLatestUserMatchIds(playerInfo.puuid);
    const lastSteveGame = lastSteveGames[0];
    return lastSteveGame;
}
