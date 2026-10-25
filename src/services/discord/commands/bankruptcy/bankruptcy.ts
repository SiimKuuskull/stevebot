import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { findUserConfirmedInProgressBet } from '../../../../database/queries/bets.query.ts';
import { InteractionError } from '../../../../tools/errors.ts';
import { log } from '../../../../tools/logger.ts';
import { goBankrupt } from '../../../bankruptcy.service.ts';
import { Interaction } from '../../../interaction.service.ts';
import { useBettingAccount } from '../../../registration.service.ts';

export const bankruptcy = {
    data: new SlashCommandBuilder().setName('bankruptcy').setDescription('Anna sisse oma pankrotiavaldus!'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const { balance, isNewUser } = await useBettingAccount(interaction.user);
        if (isNewUser) {
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **${balance.amount}** muumimünti enda uuele kontole. GL!`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (balance.bankruptcy >= 9) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su pankrotiavaldust ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            log(`${interaction.user.tag} has reached bankruptcy limit: ${balance.bankruptcy} times. No actions taken.`);
            return;
        }
        const bet = await findUserConfirmedInProgressBet(interaction.user.id);
        if (bet) {
            log(`In progress game found, bankruptcy not allowed for ${interaction.user.tag}`);
            await interaction.reply({
                content: `Sul on hetkel veel aktiivseid panuseid. Oota mängu lõppu ja proovi uuesti!`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (balance.amount > 0) {
            return displayBankruptButtons(interaction, balance.bankruptcy);
        }
        let bankruptBalance;
        try {
            bankruptBalance = await goBankrupt(interaction.user.id, balance.bankruptcy);
        } catch (error) {
            if (!(error instanceof InteractionError)) {
                throw error;
            }
            await interaction.reply({ content: error.message, components: [], flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.reply({
            content: `Oled välja kuulutanud pankroti! \n
                Su uus kontoseis on **100** muumimünti. See on sinu **${
                    bankruptBalance.bankruptcy
                }** pankrott. Sinu praegune lõiv on **${bankruptBalance.penalty * 100}%**. Lõiv väheneb iga lahendatud panusega.`,
            components: [],
            flags: MessageFlags.Ephemeral,
        });
    },
};

async function displayBankruptButtons(interaction: ChatInputCommandInteraction, bankruptcyCount: number) {
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${Interaction.BANKRUPTCY_DECLARED}:${bankruptcyCount}`)
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
        flags: MessageFlags.Ephemeral,
    });
}
