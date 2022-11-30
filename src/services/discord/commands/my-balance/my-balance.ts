import { SlashCommandBuilder } from '@discordjs/builders';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Vaata oma münditaskut!'),
    execute: async (interaction) => {
        let balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            balance = await createUserBalance({ userId: interaction.user.id, userName: interaction.user.tag });
        }
        await interaction.reply({ content: `Sul on **${balance.amount}** muumimünti`, ephemeral: true });
    },
};
