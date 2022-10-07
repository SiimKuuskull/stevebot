import { SlashCommandBuilder } from '@discordjs/builders';
import {
    createUserBalance,
    findUserBalance,
    getBankruptcyCount,
    updateBrokeUserBalance,
} from '../../../../database/queries/balance.query';
import { findUserActiveBet } from '../../../../database/queries/bets.query';
import { wipeUserLoans } from '../../../../database/queries/loans.query';
import { log } from '../../../../tools/logger';
import { displayBankruptButtons } from '../../events/interactionBankrupt/interactionBankrupt';

export const bankruptcy = {
    data: new SlashCommandBuilder().setName('bankruptcy').setDescription('Anna sisse oma pankrotiavaldus!'),
    execute: async (interaction) => {
        const balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            log(`No active balance found.`);
            await createUserBalance({ userId: interaction.user.id, userName: interaction.user.tag });
            await interaction.reply({
                content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad 100 muumimünti enda uuele kontole. GL!`,
                ephemeral: true,
            });
        }
        const bankruptCount = await getBankruptcyCount(interaction.user.id);
        if (bankruptCount >= 9) {
            await interaction.reply({
                content: `Suur Muum ei rahulda su pankrotiavaldust ja soovitab majandusliku abi otsida mujalt`,
                components: [],
                ephemeral: true,
            });
            log(`${interaction.user.tag} has reached bankruptcy limit: ${bankruptCount} times. No actions taken.`);
        }
        const activeBet = await findUserActiveBet(interaction.user.id);
        if (activeBet) {
            await interaction.reply({
                content: `Sul on hetkel veel aktiivseid panuseid. Oota mängu lõppu ja proovi uuesti!`,
                components: [],
                ephemeral: true,
            });
            log('Active game found. No actions taken.');
        }
        if (!activeBet) {
            if (balance?.amount <= 0) {
                const newBalance = await updateBrokeUserBalance(interaction.user.id);
                await wipeUserLoans(interaction.user.id);
                await interaction.reply({
                    content: `Oled välja kuulutanud pankroti! \n
                Su uus kontoseis on ${newBalance.amount} muumimünti. See on sinu ${
                        newBalance.bankruptcy
                    } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${newBalance.penalty * 100}% lõivu.`,
                    components: [],
                    ephemeral: true,
                });
            }
            if (balance?.amount > 0) {
                await displayBankruptButtons(interaction);
            }
        }
    },
};
