import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findUserUnresolvedLoan } from '../../../../database/queries/loans.query.ts';
import { InteractionError } from '../../../../tools/errors.ts';
import { log } from '../../../../tools/logger.ts';
import { useBettingAccount } from '../../../registration.service.ts';
import { issueLoan, MAX_LOAN_AMOUNT } from '../../../loan.service.ts';

export const loan = {
    data: new SlashCommandBuilder()
        .setName('loan')
        .setDescription('Laena!')
        .addIntegerOption((option) => option.setName('loan-number').setDescription('summa').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **100** muumimünti enda uuele kontole. GL!`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const existingLoan = await findUserUnresolvedLoan(interaction.user.id);
        const isBorrowingAllowed = !existingLoan && balance.bankruptcy < 5;
        if (!isBorrowingAllowed) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            log(`${interaction.user.tag} not eligible for a loan`);
            return;
        }
        const loanAmount = interaction.options.getInteger('loan-number');
        if (loanAmount === null) {
            await interaction.reply({
                content: 'Palun sisesta laenusumma.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (loanAmount >= MAX_LOAN_AMOUNT) {
            await interaction.reply({
                content: `Suur Muum ei saa sinule nii suurt laenu pakkuda. Proovi laenata vähem kui **${MAX_LOAN_AMOUNT}** muumimünti!`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        let loan;
        try {
            loan = await issueLoan(interaction.user.id, loanAmount);
        } catch (error) {
            if (!(error instanceof InteractionError)) {
                throw error;
            }
            await interaction.reply({ content: error.message, components: [], flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.reply({
            content: `${interaction.user.tag} sai **${loanAmount}** laenu intressiga **${
                loan.interest * 100
            }%**, tagasimakse aeg on **${loan.deadline}**`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
