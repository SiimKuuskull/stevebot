import { announcer } from './announcer/announcer';
import { finisher } from './finisher/finisher';

const triggers = [announcer, finisher];

export function startTriggers() {
    triggers.forEach((trigger) => {
        setInterval(trigger.execute, trigger.interval * 1000);
    });
}
