import { announcer } from './announcer/announcer';

const triggers = [announcer];

export function startTriggers() {
    triggers.forEach((trigger) => {
        setInterval(trigger.execute, trigger.interval * 1000);
    });
}
