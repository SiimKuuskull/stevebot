import { log, LoggerType } from '../../../tools/logger';
import { announcer } from './announcer/announcer';
import { finisher } from './finisher/finisher';
import { loanShark } from './loan-shark/loan-shark';

const triggers = [announcer, finisher, loanShark];

export function startTriggers() {
    triggers.forEach((trigger) => {
        setInterval(catchErrors(trigger.execute), trigger.interval * 1000);
    });
}

const catchErrors = (callback) => {
    return () => callback().catch((error) => log(error, LoggerType.ERROR));
};
