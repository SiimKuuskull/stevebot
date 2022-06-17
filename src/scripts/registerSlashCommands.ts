import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { commands } from '../services/discord/commands/command';
import { runScript } from '../tools/script-runner';

async function registerSlashCommands() {
    const clientId = '987251747615547422';
    const guildId = '112854715011784704';
    const token = 'OTg3MjUxNzQ3NjE1NTQ3NDIy.GPayNQ.tw4iRQPdvDJk7zJZzrRdOb-iD41QvR2yiFCYzw';
    const rest = new REST({ version: '9' }).setToken(token);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands.map((command) => command.data.toJSON()),
    });
}

runScript(registerSlashCommands);
