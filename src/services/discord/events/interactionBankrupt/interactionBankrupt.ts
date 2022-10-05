import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonStyle } from 'discord.js';
import { updateBrokeUserBalance } from '../../../../database/queries/balance.query';

export const interactionBankrupt = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction) => {
        if (interaction.isButton()) {
            if (interaction.customId === 'declareBankrupt') {
                const newBalance = await updateBrokeUserBalance(interaction.user.id);
                await interaction.reply({
                    content: `Oled välja kuulutanud pankroti! \n
Su uus kontoseis on ${newBalance.amount} muumimünti. See on sinu ${
                        newBalance.bankruptcy
                    } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${newBalance.penalty * 100}% lõivu.`,
                    components: [],
                    ephemeral: true,
                });
            }
            if (interaction.customId === 'cancelBankrupt') {
                await interaction.reply({
                    content: `Otsustasid mitte pankroti avaldust sisse anda. Su kontoseis jääb samaks.`,
                    components: [],
                    ephemeral: true,
                });
            }
        }
    },
};
export async function displayBankruptButtons(interaction) {
    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('declareBankrupt').setLabel('Jah, pankrot').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancelBankrupt').setLabel('Ei, mõtlesin ümber').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
        content: `Oled valinud välja kuulutada pankroti! Kas oled oma otsuses kindel?\n
Sellest otusest enam tagasi astuda ei ole võimalik! `,
        components: [rowButtons],
        ephemeral: true,
    });
}
