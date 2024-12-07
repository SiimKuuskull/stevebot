import { getAllResultedBets } from '../../database/queries/bets.query';
import { getAllBalances } from '../../services/discord/commands/leaderboard/leaderboard';

export async function handler() {
    const usersBalanceStatistics = await getAllBalances();
    const usersBetStatistics = await getAllResultedBets();
    return [usersBalanceStatistics, usersBetStatistics];
}
