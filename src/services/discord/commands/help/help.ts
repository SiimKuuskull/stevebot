import { SlashCommandBuilder } from '@discordjs/builders';

export const helpCommand = {
    data: new SlashCommandBuilder().setName('test-help').setDescription('Nimekiri kõikidest commandidest'),
    execute: async (interaction) => {
        await interaction.reply({ content: 'get fucked', ephemeral: true });
    },
};
