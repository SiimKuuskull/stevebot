import { SlashCommandBuilder } from '@discordjs/builders';
import { LoanPayBack } from '../../../../database/models/loan.model';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';
import { findUserLoan, resolveLoan } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';

export const payback = {
    data: new SlashCommandBuilder().setName('payback').setDescription('Laenu tagasimakse'),
    execute: async (interaction) => {
        const loan = await findUserLoan(interaction.user.id);
        if (!loan || loan?.payback === LoanPayBack.RESOLVED || loan?.payback === LoanPayBack.WIPED) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
                ephemeral: true,
            });
        }
        if (loan?.payback === LoanPayBack.UNRESOLVED) {
            const balance = await findUserBalance(interaction.user.id);
            if (!balance) {
                await createUserBalance(interaction.user.id);
                log(`No active balance found, created a new balance for ${interaction.user.tag}`);
            }
            const payback = loan?.amount + loan?.amount * loan?.interest;
            if (balance?.amount >= payback) {
                await resolveLoan(loan.userId);
                await interaction.reply({
                    content: `${interaction.user.tag} laenu tagasimakse õnnestus. Kõik võlgnevused likvideeritud.`,
                    ephemral: true,
                });
            }
            if (balance?.amount < payback) {
                await interaction.reply({
                    content: `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on ${
                        payback - loan?.amount
                    }`,
                    ephemral: true,
                });
            }
        }
    },
};
