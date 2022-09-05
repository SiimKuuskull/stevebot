import { log, LoggerType } from '../../../tools/logger';
import { announcer } from './announcer/announcer';
import { finisher } from './finisher/finisher';

const triggers = [announcer, finisher];

export function startTriggers() {
    triggers.forEach((trigger) => {
        setInterval(catchErrors(trigger.execute), trigger.interval * 1000);
    });
}

const catchErrors = (callback) => {
    return () => callback().catch((error) => log(error, LoggerType.ERROR));
};
