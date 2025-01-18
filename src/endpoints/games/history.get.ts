import { findSteveGames } from '../../database/queries/steveGames.query';

export async function handler() {
    const games = await findSteveGames();
    return games.map((game) => {
        return {
            id: game.gameId,
            createdAt: game.createdAt,
            gameStartTime: game.gameStart,
            gameEndTime: game.gameEnd,
            gameStatus: game.gameStatus,
            result: game.gameResult,
        };
    });
}
