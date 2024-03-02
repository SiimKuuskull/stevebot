import { findTodaysSteveGames } from '../../database/queries/steveGames.query';

export async function handler() {
    const todaySteveGames = await findTodaysSteveGames();
    return todaySteveGames;
}
