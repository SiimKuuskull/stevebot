import { Client, Collection, Intents } from 'discord.js';
import { commands } from './commands/command';
import { events } from './events';

export let client: Client;
export const botChannelId = '936984423944048713'; /* Bot kasutab Discordi channelit */

export function startDiscordBot() {
    const token = 'OTM2OTg4NDMwMDQ1NDM4MDEy.GAAJGD.EvLLnS82mKdx109My8bvtvzJ-j2B3y5md3QN4c';

    client = new Client({ intents: [Intents.FLAGS.GUILDS] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).commands = new Collection();

    registerCommands(client);
    registerEvents(client);
    client.login(token);
}

function registerCommands(client) {
    commands.forEach((command) => {
        client.commands.set(command.data.name, command);
    });
}

function registerEvents(client) {
    events.forEach((event) => {
        if (event.once) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (interaction) => event.execute(interaction, client));
        }
    });
}
