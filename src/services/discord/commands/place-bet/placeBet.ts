import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { changeBetOddsValue } from '../../../../database/queries/placeBet.query';
import { findInprogressGame, getSteveGameLength } from '../../../../database/queries/steveGames.query';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Place your bet!'),
    execute: async (interaction) => {
        const activeGame = await findInprogressGame();

        if (!activeGame) {
            await interaction.reply({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
            return;
        }
        const rowMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder().setCustomId('selectBetAmount').setPlaceholder('Panust ei ole!').addOptions(
                {
                    label: '10',
                    description: 'Panustad 10 muumicoini',
                    value: '10',
                },
                {
                    label: '20',
                    description: 'Panustad 20 muumicoini',
                    value: '20',
                },
                {
                    label: '50',
                    description: 'Panustad 50 muumicoini',
                    value: '50',
                },
                {
                    label: '100',
                    description: 'Panustad 100 muumicoini',
                    value: '100',
                },
            ),
        );
        const gameLengthFormatted = await getSteveGameLength();
        const betOdds = await changeBetOddsValue();
        await interaction.reply({
            content: `Tee oma panus! Steve mängu aeg: ${gameLengthFormatted}. Panuse koefitsent on: ${betOdds}  `,
            components: [rowMenu],
            ephemeral: true,
        });
    },
};
