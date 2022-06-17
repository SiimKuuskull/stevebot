import { CommandInteraction } from 'discord.js';
import { log } from '../../../../tools/logger';

export const interactionCreate = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: CommandInteraction, client) => {
        log(`${interaction.user.tag} in #${interaction.channel.name} used ${interaction.commandName}`);
        if (!interaction.isCommand()) {
            return;
        }
        const command = client.commands.get(interaction.commandName.toLowerCase());
        if (!command) {
            return;
        }
        await command.execute(interaction);
    },
};
