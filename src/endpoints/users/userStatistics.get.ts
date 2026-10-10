import { getAllResultedBets } from '../../database/queries/bets.query.ts';
import { getAllBalances } from '../../services/discord/commands/leaderboard/leaderboard.ts';

export async function handler() {
    const usersBalanceStatistics = await getAllBalances();
    const usersBetStatistics = await getAllResultedBets();
    return [usersBalanceStatistics, usersBetStatistics];
}
