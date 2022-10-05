import { SlashCommandBuilder } from '@discordjs/builders';
import { createUserBalance, findUserBalance, updateBrokeUserBalance } from '../../../../database/queries/balance.query';
import { findUserActiveBet } from '../../../../database/queries/bets.query';
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
