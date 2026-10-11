import { getAllResultedBets } from '../../database/queries/bets.query.ts';
import { getAllBalances } from '../../database/queries/balance.query.ts';

export async function handler() {
    const usersBalanceStatistics = await getAllBalances();
    const usersBetStatistics = await getAllResultedBets();
    return [usersBalanceStatistics, usersBetStatistics];
}
