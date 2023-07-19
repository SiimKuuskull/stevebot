import { Request } from 'express';
import { handler as PingHandler } from '../endpoints/ping.get';
import { handler as GamesHistoryHandler } from '../endpoints/games/history.get';

export const routes: Route[] = [
    { url: '/games/history', method: 'get', handler: GamesHistoryHandler },
    { url: '/ping', method: 'get', handler: PingHandler },
];

interface Route {
    handler: (request: Request) => any | Promise<any>;
    method: 'get' | 'post' | 'put' | 'delete';
    url: string;
}
