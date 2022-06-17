import { SlashCommandBuilder } from '@discordjs/builders';

export const helpCommand = {
    data: new SlashCommandBuilder().setName('test-help').setDescription('Get a list of all possible commands'),
    execute: async (interaction) => {
        await interaction.reply({ content: 'get fucked', ephemeral: true });
    },
};
