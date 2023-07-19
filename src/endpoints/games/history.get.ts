import { findSteveGames } from '../../database/queries/steveGames.query';

export async function handler() {
    const games = await findSteveGames();
    return games.map((game) => {
        return {
            id: game.gameId,
            result: game.gameResult,
        };
    });
}
