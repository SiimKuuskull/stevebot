import { Request } from 'express';
import { handler as PingHandler } from '../endpoints/ping.get';
import { handler as GamesHistoryHandler } from '../endpoints/games/history.get';
import { handler as GamesHistoryTodayHandler } from '../endpoints/games/historyToday.get';
import { handler as LastSeenPlayerHandler } from '../endpoints/player/lastSeenPlayer.get';
import { handler as PlayerStatusHandler } from '../endpoints/player/playerStatus.get';
import { handler as PlayerStatsHandler } from '../endpoints/player/playerStats.get';
import { handler as FindTransactionsHandler } from '../endpoints/transactions/findTransactions.get';
import { handler as UserCountHandler } from '../endpoints/users/userCount.get';

export const routes: Route[] = [
    { url: '/games/history', method: 'get', handler: GamesHistoryHandler },
    { url: '/games/history-today', method: 'get', handler: GamesHistoryTodayHandler },
    { url: '/player/player-status', method: 'get', handler: PlayerStatusHandler },
    { url: '/player/last-seen-player', method: 'get', handler: LastSeenPlayerHandler },
    { url: '/player/player-stats', method: 'get', handler: PlayerStatsHandler },
    { url: '/transactions/find-transactions', method: 'get', handler: FindTransactionsHandler },
    { url: '/users/user-count', method: 'get', handler: UserCountHandler },
    { url: '/ping', method: 'get', handler: PingHandler },
];

interface Route {
    handler: (request: Request) => any;
    method: 'get' | 'post' | 'put' | 'delete';
    url: string;
}
