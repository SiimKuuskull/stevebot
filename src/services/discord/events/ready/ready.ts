import { Client, Events } from 'discord.js';
import { log } from '../../../../tools/logger.ts';

export const ready = {
    name: Events.ClientReady,
    once: true,
    execute: (client: Client) => {
        log(`Ready! Logged in as ${client.user?.tag}`);
    },
};
