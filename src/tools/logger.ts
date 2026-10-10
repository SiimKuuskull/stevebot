import chalk from 'chalk';
import { inspect } from 'util';

let isLoggingDisabled = false;
export function disableLogs() {
    isLoggingDisabled = true;
}

export function enableLogs() {
    isLoggingDisabled = false;
}

export function log(message?, type = LoggerType.INFO) {
    const colorByType = {
        [LoggerType.ERROR]: 'red',
        [LoggerType.INFO]: 'cyanBright',
    };
    const color = colorByType[type] || 'blue';
    if (!isLoggingDisabled) {
        if (typeof message === 'object' && !(message instanceof Error)) {
            try {
                message = JSON.stringify(message);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
                return inspect(message, false, 5);
            }
        }
        const { fileName, lineNumber } = getFileNameAndLineNumber(message);
        if (message instanceof Error) {
            message = message.message;
        }
        console.log(new Date().toLocaleTimeString(), chalk[color](message ?? ''), `-${fileName}:${lineNumber}`);
    }
}

export function getFileNameAndLineNumber(message) {
    try {
        let row = new Error('New Error').stack.toString().split('\n')[3];
        if (message instanceof Error) {
            row = message.stack.toString().split('\n')[1];
        }
        const [, fileName, lineNumber] = row.match(/[/\\](?:src|dist)[/\\](.+?):(\d+):\d+/);
        return {
            fileName,
            lineNumber,
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return {};
    }
}

export enum LoggerType {
    ERROR = 'error',
    INFO = 'info',
}
