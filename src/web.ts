import express from 'express';
import 'source-map-support/register';
import { routes } from './tools/router';
import { log } from './tools/logger';

(async () => {
    const app = express();
    app.use(express.json());
    log('Available routes:');
    routes.forEach((route) => {
        app[route.method](route.url, async (req, res) => {
            log(`${route.method.toUpperCase()} - ${route.url}`);
            const response = await route.handler(req);
            res.json(response);
        });
        log(`${'localhost:3000'}${route.url} ${route.method.toUpperCase()}`);
    });

    app.listen(3000);
    log('Server listening on port 3000');
})();

process.on('uncaughtExceptionMonitor', (e) => {
    console.error('uncaughtException', e);
});

process.on('unhandledRejection', (e) => {
    console.error('unhandledRejection', e);
});
