import { Client } from 'discord.js';
import { log } from '../../../../tools/logger';

export const ready = {
    name: 'ready',
    once: true,
    execute: (client: Client) => {
        log(`Ready! Logged in as ${client.user.tag}`);
    },
};
