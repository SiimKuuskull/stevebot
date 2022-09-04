import { log, LoggerType } from './logger';
import { config as envConfig } from 'dotenv';

export async function runScript(callback: () => Promise<void>) {
    envConfig({ path: '.env.config' });
    try {
        log('-------Script started-------');
        await callback();
        log('-------Script finished------');
        process.exit(0);
    } catch (error) {
        log(error, LoggerType.ERROR);
        process.exit(1);
    }
}
