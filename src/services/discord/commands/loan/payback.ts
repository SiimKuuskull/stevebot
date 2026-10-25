import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { InteractionError } from '../../../../tools/errors.ts';
import { log } from '../../../../tools/logger.ts';
import { repayLoan } from '../../../loan.service.ts';

export const payback = {
    data: new SlashCommandBuilder().setName('payback').setDescription('Laenu tagasimakse'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        let loan;
        try {
            loan = await repayLoan(interaction.user.id);
        } catch (error) {
            if (!(error instanceof InteractionError)) {
                throw error;
            }
            await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral, components: [] });
            return;
        }
        if (!loan) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
                flags: MessageFlags.Ephemeral,
                components: [],
            });
            return;
        }
        log(`${loan.userId} paid back their loan ${loan.id}`);
        await interaction.reply({
            content: `${interaction.user.tag} laenu tagasimakse õnnestus. Kõik võlgnevused likvideeritud.`,
            flags: MessageFlags.Ephemeral,
            components: [],
        });
    },
};
