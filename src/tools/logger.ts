import chalk from 'chalk';
import { inspect } from 'util';

let isLoggingDisabled = false;
export function disableLogs() {
    isLoggingDisabled = true;
}

export function log(message?, type = LoggerType.INFO) {
    const colorByType = {
        [LoggerType.ERROR]: 'red',
        [LoggerType.INFO]: 'cyanBright',
    };
    const color = colorByType[type] || 'blue';
    if (!isLoggingDisabled) {
        if (typeof message === 'object') {
            try {
                message = JSON.stringify(message);
            } catch (error) {
                return inspect(message, false, 5);
            }
        }
        console.log(chalk[color](message || ''));
    }
}

export enum LoggerType {
    ERROR = 'error',
    INFO = 'info',
}
