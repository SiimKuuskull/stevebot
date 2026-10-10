import { getAllBalancesCount } from '../../database/queries/balance.query.ts';

export async function handler() {
    const userCount = await getAllBalancesCount();
    return userCount;
}
