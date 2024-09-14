import { ActionRowBuilder, ButtonBuilder, SlashCommandBuilder } from '@discordjs/builders';
import { ButtonStyle } from 'discord.js';
import { updateBrokeUserBalance } from '../../../../database/queries/balance.query';
import { findUserInProgressBet } from '../../../../database/queries/bets.query';
import { wipeUserLoans } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { Interaction } from '../../../interaction.service';
import { useBettingAccount } from '../../../registration.service';

export const bankruptcy = {
    data: new SlashCommandBuilder().setName('bankruptcy').setDescription('Anna sisse oma pankrotiavaldus!'),
    execute: async (interaction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **${balance.amount}** muumimünti enda uuele kontole. GL!`,
                ephemeral: true,
            });
            return;
        }
        if (balance.bankruptcy >= 9) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su pankrotiavaldust ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                ephemeral: true,
            });
            log(`${interaction.user.tag} has reached bankruptcy limit: ${balance.bankruptcy} times. No actions taken.`);
            return;
        }
        const bet = await findUserInProgressBet(interaction.user.id);
        if (bet) {
            log(`In progress game found, bankruptcy not allowed for ${interaction.user.tag}`);
            await interaction.reply({
                content: `Sul on hetkel veel aktiivseid panuseid. Oota mängu lõppu ja proovi uuesti!`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (balance.amount > 0) {
            return displayBankruptButtons(interaction);
        }
        const newBalance = await updateBrokeUserBalance(interaction.user.id);
        await wipeUserLoans(interaction.user.id);
        await interaction.reply({
            content: `Oled välja kuulutanud pankroti! \n
                Su uus kontoseis on **${newBalance.amount}** muumimünti. See on sinu **${
                    newBalance.bankruptcy
                }** pankrott. Järgnevalt **5** võidult maksad Suurele Muumile **${newBalance.penalty * 100}%** lõivu.`,
            components: [],
            ephemeral: true,
        });
    },
};

async function displayBankruptButtons(interaction) {
    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(Interaction.BANKRUPTCY_DECLARED)
            .setLabel('Jah, pankrot')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(Interaction.BANKRUPTCY_DENIED)
            .setLabel('Ei, mõtlesin ümber')
            .setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
        content: `Oled valinud välja kuulutada pankroti! Kas oled oma otsuses kindel?\n
            Sellest otsusest enam tagasi astuda _**EI**_ ole võimalik! `,
        components: [rowButtons],
        ephemeral: true,
    });
}
