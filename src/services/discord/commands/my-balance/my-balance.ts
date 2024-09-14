import { SlashCommandBuilder } from '@discordjs/builders';
import { useBettingAccount } from '../../../registration.service';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Vaata oma münditaskut!'),
    execute: async (interaction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **100** muumimünti. :wink:`,
                ephemeral: true,
            });
            return;
        }
        await interaction.reply({ content: `Sul on **${balance.amount}** muumimünti`, ephemeral: true });
        return;
    },
};
