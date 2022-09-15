import { BaseInteraction } from 'discord.js';
import { log } from '../../../../tools/logger';

export const interactionCreate = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction, client) => {
        if (interaction.isCommand()) {
            log(`${interaction.user.tag} in #${interaction.channel.name} used ${interaction.commandName}`);
            const command = client.commands.get(interaction.commandName.toLowerCase());
            if (command) {
                await command.execute(interaction);
            }
        }
    },
};
