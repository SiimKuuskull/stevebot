import { Request } from 'express';
import { handler as PingHandler } from '../endpoints/ping.get.ts';
import { handler as GamesHistoryHandler } from '../endpoints/games/history.get.ts';
import { handler as GamesHistoryTodayHandler } from '../endpoints/games/historyToday.get.ts';
import { handler as LastSeenPlayerHandler } from '../endpoints/player/lastSeenPlayer.get.ts';
import { handler as PlayerStatusHandler } from '../endpoints/player/playerStatus.get.ts';
import { handler as PlayerStatsHandler } from '../endpoints/player/playerStats.get.ts';
import { handler as FindTransactionsHandler } from '../endpoints/transactions/findTransactions.get.ts';
import { handler as UserCountHandler } from '../endpoints/users/userCount.get.ts';
import { handler as UserStatisticsHandler } from '../endpoints/users/userStatistics.get.ts';

export const routes: Route[] = [
    { url: '/games/history', method: 'get', handler: GamesHistoryHandler },
    { url: '/games/history-today', method: 'get', handler: GamesHistoryTodayHandler },
    { url: '/player/player-status', method: 'get', handler: PlayerStatusHandler },
    { url: '/player/last-seen-player', method: 'get', handler: LastSeenPlayerHandler },
    { url: '/player/player-stats', method: 'get', handler: PlayerStatsHandler },
    { url: '/transactions/find-transactions', method: 'get', handler: FindTransactionsHandler },
    { url: '/users/user-count', method: 'get', handler: UserCountHandler },
    { url: '/ping', method: 'get', handler: PingHandler },
    { url: '/users/user-statistics', method: 'get', handler: UserStatisticsHandler },
];

interface Route {
    handler: (request: Request) => any;
    method: 'get' | 'post' | 'put' | 'delete';
    url: string;
}
