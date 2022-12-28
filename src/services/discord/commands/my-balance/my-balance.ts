import { SlashCommandBuilder } from '@discordjs/builders';
import { findUserBalance } from '../../../../database/queries/balance.query';
import { createBettingAccount } from '../../../registration.service';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Vaata oma münditaskut!'),
    execute: async (interaction) => {
        let balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            [balance] = await createBettingAccount(interaction.user.id, interaction.user.tag);
        }
        await interaction.reply({ content: `Sul on **${balance.amount}** muumimünti`, ephemeral: true });
    },
};
