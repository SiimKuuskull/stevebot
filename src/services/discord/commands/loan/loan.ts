import { SlashCommandBuilder } from '@discordjs/builders';
import { LoanPayBack } from '../../../../database/models/loan.model';
import {
    createUserBalance,
    findUserBalance,
    getBankruptcyCount,
    updateUserLoanBalance,
} from '../../../../database/queries/balance.query';
import { createLoan, findUserActiveLoan } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';

export const loan = {
    data: new SlashCommandBuilder()
        .setName('loan')
        .setDescription('Laena!')
        .addIntegerOption((option) => option.setName('loan-number').setDescription('summa').setRequired(true)),
    execute: async (interaction) => {
        const balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            log(`No active balance found.`);
            await createUserBalance({ userId: interaction.user.id, userName: interaction.user.tag });
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **100** muumimünti enda uuele kontole. GL!`,
                ephemeral: true,
            });
        }
        if (balance) {
            const bankruptCount = await getBankruptcyCount(interaction.user.id);
            const [existingLoan] = await findUserActiveLoan(interaction.user.id);
            if (bankruptCount >= 5 || existingLoan?.payback === LoanPayBack.UNRESOLVED) {
                await interaction.reply({
                    content: `Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt`,
                    components: [],
                    ephemeral: true,
                });
                log(`${interaction.user.tag} has reached bankruptcy limit: ${bankruptCount} times. No actions taken.`);
                return;
            }
            if (bankruptCount < 5) {
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
        }
    },
};
