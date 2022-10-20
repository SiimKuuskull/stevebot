import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { commands } from './commands/command';
import { events } from './events';

export let client: Client;
export const botChannelId = process.env.DISCORD_BOT_CHANNEL_ID;

export function startDiscordBot() {
    const token = process.env.DISCORD_BOT_TOKEN;

    client = new Client({ intents: [GatewayIntentBits.Guilds] });
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
