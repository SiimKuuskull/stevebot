import { countAllBalances } from '../../database/queries/balance.query';

export async function handler() {
    const userCount = await countAllBalances();
    return userCount[0].count;
}
