import { SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../../../../database/db';
import { Balance } from '../../../../database/models/balance.model';
import { Loan, LoanPayBack } from '../../../../database/models/loan.model';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';
import { findUserLoan } from '../../../../database/queries/loans.query';
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

async function resolveLoan(userId: string) {
    const [loan] = await db<Loan>('loans').where({ userId: userId, payback: LoanPayBack.UNRESOLVED });
    const [balance] = await db<Balance>('loans').where('userId', userId);
    await db<Balance>('balance')
        .where('userId', userId)
        .update({ amount: balance.amount - (loan.amount + loan.amount * loan.interest) });
    await db<Loan>('loans').where('userId', userId).update({ payback: LoanPayBack.RESOLVED });
    log(
        `${loan.userName} loan is now ${LoanPayBack.RESOLVED} and debt of ${
            loan.amount + loan.amount * loan.interest
        } has been cleared.`,
    );
    return;
}