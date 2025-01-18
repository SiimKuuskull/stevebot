import { getAllBalancesCount } from '../../database/queries/balance.query';

export async function handler() {
    const userCount = await getAllBalancesCount();
    return userCount;
}
