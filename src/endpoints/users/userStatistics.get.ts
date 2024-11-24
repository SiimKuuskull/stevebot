import { getAllBalances } from '../../services/discord/commands/leaderboard/leaderboard';

export async function handler() {
    const userStatistics = await getAllBalances();
    return userStatistics;
}
