import { getLatestTransactions } from '../../database/queries/transactions.query.ts';

export async function handler() {
    const latestTransactions = await getLatestTransactions();
    return latestTransactions;
}
