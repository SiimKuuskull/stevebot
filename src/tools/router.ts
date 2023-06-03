import { Request } from 'express';
import { handler as PingHandler } from '../endpoints/ping.get';

export const routes: Route[] = [{ url: '/ping', method: 'get', handler: PingHandler }];

interface Route {
    handler: (request: Request) => any | Promise<any>;
    method: 'get' | 'post' | 'put' | 'delete';
    url: string;
}
