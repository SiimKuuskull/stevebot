import { REST, Routes } from 'discord.js';
import { commands } from '../services/discord/commands/command';
import { runScript } from '../tools/script-runner';

async function registerSlashCommands() {
    const clientId = process.env.DISCORD_BOT_APPLICATION_ID;
    const guildId = process.env.DISCORD_SERVER_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    const rest = new REST().setToken(token);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands.map((command) => command.data.toJSON()),
    });
}

runScript(registerSlashCommands);
