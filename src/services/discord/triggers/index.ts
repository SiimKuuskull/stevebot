import { log, LoggerType } from '../../../tools/logger.ts';
import { announcer } from './announcer/announcer.ts';
import { finisher } from './finisher/finisher.ts';
import { loanShark } from './loan-shark/loan-shark.ts';

const triggers = [announcer, finisher, loanShark];

export function startTriggers() {
    triggers.forEach((trigger) => {
        setInterval(catchErrors(trigger.execute), trigger.interval * 1000);
    });
}

const catchErrors = (callback) => {
    return () => callback().catch((error) => log(error, LoggerType.ERROR));
};
