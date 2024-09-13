import { SlashCommandBuilder } from '@discordjs/builders';
import { LoanPayBack } from '../../../../database/models/loan.model';
import { updateUserLoanBalance } from '../../../../database/queries/balance.query';
import { createLoan, findUserActiveLoan } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { useBettingAccount } from '../../../registration.service';

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
        const [existingLoan] = await findUserActiveLoan(interaction.user.id);
        if (balance.bankruptcy >= 5 || existingLoan?.payback === LoanPayBack.UNRESOLVED) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                ephemeral: true,
            });
            log(`${interaction.user.tag} has reached bankruptcy limit: ${balance.bankruptcy} times. No actions taken.`);
            return;
        }
        if (balance.bankruptcy < 5) {
            const loanInput = interaction.options.getInteger('loan-number');
            if (loanInput >= 3000) {
                await interaction.reply({
                    content: `Suur Muum ei saa sinule nii suurt laenu pakkuda. Proovi laenata vähem kui **3000** muumimünti!`,
                    components: [],
                    ephemeral: true,
                });
            }
            if (loanInput < 3000) {
                const loan = await createLoan({
                    userId: interaction.user.id,
                    amount: loanInput,
                    interest: 0.08,
                });
                await updateUserLoanBalance(interaction.user.id, loanInput);
                await interaction.reply({
                    content: `${interaction.user.tag} sai **${loanInput}** laenu intressiga **${
                        loan.interest * 100
                    }%**, tagasimakse aeg on **${loan.deadline}**`,
                    ephemeral: true,
                });
            }
        }
    },
};
