import { SlashCommandBuilder } from '@discordjs/builders';
import { findUserBalance } from '../../../../database/queries/balance.query';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Check balance'),
    execute: async (interaction) => {
        const balance = await findUserBalance(interaction.user.id);
        await interaction.reply({ content: `Your balance is ${balance?.amount || 0}`, ephemeral: true });
    },
};
