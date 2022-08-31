import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Place your bet!'),
    execute: async (interaction) => {
        const rowMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder().setCustomId('selectBetAmount').setPlaceholder('Panust ei ole!').addOptions(
                {
                    label: '-10',
                    description: 'Panustad 10',
                    value: '10',
                },
                {
                    label: '-20',
                    description: 'Panustad 20',
                    value: '20',
                },
                {
                    label: '-50',
                    description: 'Panustad 50',
                    value: '50',
                },
                {
                    label: '-100',
                    description: 'Panustad 100',
                    value: '100',
                },
            ),
        );

        await interaction.reply({
            content: 'Tee oma panus!',
            components: [rowMenu],
            ephemeral: true,
        });
    },
};
