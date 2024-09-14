import { SlashCommandBuilder } from '@discordjs/builders';
import { TransactionType } from '../../../../database/models/transactions.model';
import { createLoan, findUserUnresolvedLoan } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { useBettingAccount } from '../../../registration.service';
import { makeTransaction } from '../../../transaction.service';

export const loan = {
    data: new SlashCommandBuilder()
        .setName('loan')
        .setDescription('Laena!')
        .addIntegerOption((option) => option.setName('loan-number').setDescription('summa').setRequired(true)),
    execute: async (interaction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **100** muumimünti enda uuele kontole. GL!`,
                ephemeral: true,
            });
            return;
        }
        const existingLoan = await findUserUnresolvedLoan(interaction.user.id);
        const isBorrowingAllowed = !existingLoan && balance.bankruptcy < 5;
        if (!isBorrowingAllowed) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                ephemeral: true,
            });
            log(`${interaction.user.tag} not eligible for a loan`);
            return;
        }
        const loanAmount = interaction.options.getInteger('loan-number');
        if (loanAmount >= MAX_LOAN_AMOUNT) {
            await interaction.reply({
                content: `Suur Muum ei saa sinule nii suurt laenu pakkuda. Proovi laenata vähem kui **${MAX_LOAN_AMOUNT}** muumimünti!`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        const loan = await createLoan({
            userId: balance.userId,
            amount: loanAmount,
            interest: 0.08,
        });
        await makeTransaction({
            amount: loanAmount,
            externalTransactionId: loan.id,
            type: TransactionType.LOAN_RECEIVED,
            userId: balance.userId,
        });
        await interaction.reply({
            content: `${interaction.user.tag} sai **${loanAmount}** laenu intressiga **${
                loan.interest * 100
            }%**, tagasimakse aeg on **${loan.deadline}**`,
            ephemeral: true,
        });
    },
};

const MAX_LOAN_AMOUNT = 3000;
