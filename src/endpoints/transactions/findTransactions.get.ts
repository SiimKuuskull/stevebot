import { getLatestTransactions } from '../../database/queries/transactions.query';

export async function handler() {
    const latestTransactions = await getLatestTransactions();
    return latestTransactions;
}
