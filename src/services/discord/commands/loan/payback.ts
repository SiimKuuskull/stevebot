import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import lodash from 'lodash';
import { TransactionType } from '../../../../database/models/transactions.model.ts';
import { findUserBalance } from '../../../../database/queries/balance.query.ts';
import { findUserUnresolvedLoan, resolveLoan } from '../../../../database/queries/loans.query.ts';
import { log } from '../../../../tools/logger.ts';
import { makeTransaction } from '../../../transaction.service.ts';

export const payback = {
    data: new SlashCommandBuilder().setName('payback').setDescription('Laenu tagasimakse'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const loan = await findUserUnresolvedLoan(interaction.user.id);
        if (!loan) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
                flags: MessageFlags.Ephemeral,
                components: [],
            });
            return;
        }
        const balance = await findUserBalance(loan.userId);
        if (!balance) {
            log(`Could not find balance for user ${loan.userId}`);
            return;
        }
        const payback = loan.amount + loan.amount * loan.interest;
        if (balance.amount < payback) {
            await interaction.reply({
                content: `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on **${lodash.round(
                    payback - balance.amount,
                    2,
                )}**`,
                flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
            components: [],
        });
    },
};
