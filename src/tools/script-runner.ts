import { log, LoggerType } from './logger';

export async function runScript(callback: () => Promise<void>) {
    try {
        log('-------Script started-------');
        log();
        await callback();
        log('-------Script finished------');
        process.exit(0);
    } catch (error) {
        log(error, LoggerType.ERROR);
        process.exit(1);
    }
}
