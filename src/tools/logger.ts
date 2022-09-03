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
        const { fileName, lineNumber } = getFileNameAndLineNumber();
        console.log(new Date().toLocaleTimeString(), chalk[color](message || ''), `-${fileName}:${lineNumber}`);
    }
}

export function getFileNameAndLineNumber() {
    try {
        const row = new Error('New Error').stack.toString().split('\n')[3];
        const path = row.split('\\dist\\');
        const [fileName, lineNumber] = path[1].split(':');
        return {
            fileName,
            lineNumber,
        };
    } catch (error) {
        return {};
    }
}

export enum LoggerType {
    ERROR = 'error',
    INFO = 'info',
}
