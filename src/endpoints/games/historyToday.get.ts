import { findTodaysSteveGames } from '../../database/queries/steveGames.query.ts';

export async function handler() {
    const todaySteveGames = await findTodaysSteveGames();
    return todaySteveGames;
}
