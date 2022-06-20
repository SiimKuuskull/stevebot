import { Client, Collection, Intents } from 'discord.js';
import { commands } from './commands/command';
import { events } from './events';

export let client: Client;
export const botChannelId = '619245651594838027';

export function startDiscordBot() {
    const token = 'OTg3MjUxNzQ3NjE1NTQ3NDIy.GPayNQ.tw4iRQPdvDJk7zJZzrRdOb-iD41QvR2yiFCYzw';

    client = new Client({ intents: [Intents.FLAGS.GUILDS] });
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
