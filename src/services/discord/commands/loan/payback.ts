import { SlashCommandBuilder } from '@discordjs/builders';
import { round } from 'lodash';
import { TransactionType } from '../../../../database/models/transactions.model';
import { findUserBalance } from '../../../../database/queries/balance.query';
import { findUserUnresolvedLoan, resolveLoan } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { makeTransaction } from '../../../transaction.service';

export const payback = {
    data: new SlashCommandBuilder().setName('payback').setDescription('Laenu tagasimakse'),
    execute: async (interaction) => {
        const loan = await findUserUnresolvedLoan(interaction.user.id);
        if (!loan) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
                ephemeral: true,
                components: [],
            });
            return;
        }
        const balance = await findUserBalance(loan.userId);
        const payback = loan.amount + loan.amount * loan.interest;
        if (balance.amount < payback) {
            await interaction.reply({
                content: `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on **${round(
                    payback - balance.amount,
                    2,
                )}**`,
                ephemral: true,
                components: [],
            });
            return;
        }
        await Promise.all([
            resolveLoan(loan.id),
            makeTransaction({
                amount: -payback,
                externalTransactionId: loan.id,
                type: TransactionType.LOAN_PAYBACK,
                userId: loan.userId,
            }),
        ]);
        log(`${loan.userId} paid back their loan ${loan.id}`);
        await interaction.reply({
            content: `${interaction.user.tag} laenu tagasimakse õnnestus. Kõik võlgnevused likvideeritud.`,
            ephemral: true,
            components: [],
        });
    },
};
