import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function betWinLose(interaction) {
    const rowButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('winBet').setLabel('Steve VÕIDAB!').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('loseBet').setLabel('Steve KAOTAB!').setStyle(ButtonStyle.Danger),
    );
    await interaction.update({ content: 'Vali oma otsus!', components: [rowButton], ephemeral: true });
}
