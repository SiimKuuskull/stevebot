import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { useBettingAccount } from '../../../registration.service.ts';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Vaata oma münditaskut!'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **100** muumimünti. :wink:`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply({ content: `Sul on **${balance.amount}** muumimünti`, flags: MessageFlags.Ephemeral });
        return;
    },
};
