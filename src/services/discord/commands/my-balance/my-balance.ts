import { SlashCommandBuilder } from '@discordjs/builders';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Check balance'),
    execute: async (interaction) => {
        await interaction.reply({ content: 'Your balance is 0', ephemeral: true });
    },
};
