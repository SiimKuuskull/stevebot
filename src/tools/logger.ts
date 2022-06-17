import chalk from 'chalk';

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
        console.log(chalk[color](message || ''));
    }
}

export enum LoggerType {
    ERROR = 'error',
    INFO = 'info',
}
